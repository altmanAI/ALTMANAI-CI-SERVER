function escapeRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

export function globToRegex(glob) {
  let regex = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];
    const afterNext = glob[i + 2];
    if (char === '*' && next === '*' && afterNext === '/') {
      regex += '(?:.*/)?';
      i += 2;
    } else if (char === '*' && next === '*') {
      regex += '.*';
      i += 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += escapeRegex(char);
    }
  }
  return new RegExp(`^${regex}$`);
}

function matchesAny(path, globs = []) {
  return globs.some((glob) => globToRegex(glob).test(path));
}

function finding(code, severity, message, path = null) {
  return { code, severity, message, path };
}

function hasStandaloneFounderApproval(comments, founderLogin, phrase) {
  const founder = founderLogin.toLowerCase();
  return comments.some((comment) => {
    const login = comment?.user?.login?.toLowerCase();
    return login === founder && String(comment?.body || '').trim() === phrase;
  });
}

export function evaluatePullRequest({ policy, pullRequest, files, comments, founderLogin, approvalPhrase }) {
  const findings = [];
  const body = String(pullRequest.body || '');
  const filePaths = files.map((file) => file.filename);
  const protectedPaths = filePaths.filter((path) => matchesAny(path, policy.protectedPathGlobs));
  const forbiddenPaths = filePaths.filter((path) => matchesAny(path, policy.forbiddenPathGlobs));
  const material = protectedPaths.length > 0 || files.length >= policy.materialChangeFileThreshold;
  const approvalRequired = policy.approvalMode === 'all_changes' ||
    (policy.approvalMode === 'material_changes' && material);
  const founderApproved = hasStandaloneFounderApproval(comments, founderLogin, approvalPhrase);

  if (files.length > policy.maxChangedFiles) {
    findings.push(finding('changed_files_limit', 'failure', `PR changes ${files.length} files; limit is ${policy.maxChangedFiles}.`));
  }

  for (const path of forbiddenPaths) {
    findings.push(finding('forbidden_path', 'failure', 'Potential credential or private-key file must not be committed.', path));
  }

  for (const heading of policy.requiredPrSections) {
    if (!body.includes(heading)) {
      findings.push(finding('missing_pr_section', 'failure', `Required PR section is missing: ${heading}`));
    }
  }

  if (policy.requireAiDisclosure && !policy.aiDisclosureMarkers.some((marker) => body.includes(marker))) {
    findings.push(finding('missing_ai_disclosure', 'failure', 'PR body must disclose AI assistance using an approved marker.'));
  }

  if (approvalRequired && !founderApproved) {
    findings.push(finding(
      'founder_approval_missing',
      'failure',
      `Material changes require an exact standalone comment from @${founderLogin}: ${approvalPhrase}`
    ));
  }

  const failures = findings.filter((item) => item.severity === 'failure');
  const conclusion = failures.length === 0 ? 'success' : 'failure';
  const title = conclusion === 'success' ? 'Governance requirements satisfied' : 'Governance requirements not satisfied';
  const summaryLines = [
    `Decision: **${conclusion.toUpperCase()}**`,
    `Policy: \`${policy.policyVersion}\``,
    `Changed files: **${files.length}**`,
    `Material change: **${material ? 'yes' : 'no'}**`,
    `Founder approval required: **${approvalRequired ? 'yes' : 'no'}**`,
    `Founder approval recorded: **${founderApproved ? 'yes' : 'no'}**`
  ];

  if (findings.length) {
    summaryLines.push('', 'Findings:');
    for (const item of findings.slice(0, 20)) {
      summaryLines.push(`- ${item.path ? `\`${item.path}\`: ` : ''}${item.message}`);
    }
  }

  const annotations = findings
    .filter((item) => item.path)
    .slice(0, 50)
    .map((item) => ({
      path: item.path,
      start_line: 1,
      end_line: 1,
      annotation_level: item.severity === 'failure' ? 'failure' : 'warning',
      message: item.message,
      title: item.code
    }));

  return {
    conclusion,
    title,
    summary: summaryLines.join('\n'),
    findings,
    annotations,
    metadata: {
      fileCount: files.length,
      material,
      protectedPaths,
      approvalRequired,
      founderApproved
    }
  };
}
