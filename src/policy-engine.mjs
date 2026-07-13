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

function normalizeHeading(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function hasMarkdownHeading(body, requiredHeading) {
  const expected = normalizeHeading(requiredHeading);
  return String(body || '').split(/\r?\n/).some((line) => normalizeHeading(line) === expected);
}

function hasStandaloneFounderApproval(comments, founderLogin, founderUserId, phrase) {
  const founder = String(founderLogin || '').toLowerCase();
  const expectedUserId = founderUserId === null || founderUserId === undefined ? null : String(founderUserId);
  return comments.some((comment) => {
    const login = String(comment?.user?.login || '').toLowerCase();
    const userId = comment?.user?.id === null || comment?.user?.id === undefined ? null : String(comment.user.id);
    const identityMatches = login === founder && (expectedUserId === null || userId === expectedUserId);
    return identityMatches && String(comment?.body || '').trim() === phrase;
  });
}

export function evaluatePullRequest({
  policy,
  pullRequest,
  files = [],
  comments = [],
  founderLogin,
  founderUserId = null,
  approvalPhrase
}) {
  const findings = [];
  const body = String(pullRequest?.body || '');
  const safeFiles = Array.isArray(files) ? files : [];
  const safeComments = Array.isArray(comments) ? comments : [];
  const filePaths = safeFiles.map((file) => file?.filename).filter((path) => typeof path === 'string' && path.length > 0);
  const protectedPaths = filePaths.filter((path) => matchesAny(path, policy.protectedPathGlobs));
  const forbiddenPaths = filePaths.filter((path) => matchesAny(path, policy.forbiddenPathGlobs));
  const material = protectedPaths.length > 0 || safeFiles.length >= policy.materialChangeFileThreshold;
  const approvalRequired = policy.approvalMode === 'all_changes' ||
    (policy.approvalMode === 'material_changes' && material);
  const founderApproved = hasStandaloneFounderApproval(
    safeComments,
    founderLogin,
    founderUserId,
    approvalPhrase
  );

  if (safeFiles.length > policy.maxChangedFiles) {
    findings.push(finding('changed_files_limit', 'failure', `PR changes ${safeFiles.length} files; limit is ${policy.maxChangedFiles}.`));
  }

  for (const path of forbiddenPaths) {
    findings.push(finding('forbidden_path', 'failure', 'Potential credential or private-key file must not be committed.', path));
  }

  for (const heading of policy.requiredPrSections) {
    if (!hasMarkdownHeading(body, heading)) {
      findings.push(finding('missing_pr_section', 'failure', `Required PR section is missing: ${heading}`));
    }
  }

  const normalizedBody = body.toLowerCase();
  if (policy.requireAiDisclosure && !policy.aiDisclosureMarkers.some((marker) => normalizedBody.includes(marker.toLowerCase()))) {
    findings.push(finding('missing_ai_disclosure', 'failure', 'PR body must disclose AI assistance using an approved marker.'));
  }

  if (approvalRequired && !founderApproved) {
    const identity = founderUserId ? `@${founderLogin} (GitHub user ID ${founderUserId})` : `@${founderLogin}`;
    findings.push(finding(
      'founder_approval_missing',
      'failure',
      `Material changes require an exact standalone comment from ${identity}: ${approvalPhrase}`
    ));
  }

  const failures = findings.filter((item) => item.severity === 'failure');
  const conclusion = failures.length === 0 ? 'success' : 'failure';
  const title = conclusion === 'success' ? 'Governance requirements satisfied' : 'Governance requirements not satisfied';
  const summaryLines = [
    `Decision: **${conclusion.toUpperCase()}**`,
    `Policy: \`${policy.policyVersion}\``,
    `Changed files: **${safeFiles.length}**`,
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
      fileCount: safeFiles.length,
      material,
      protectedPaths,
      approvalRequired,
      founderApproved
    }
  };
}
