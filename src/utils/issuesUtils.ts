// The list of primaryLabels
export const primaryLabelList = ["bug", "documentation", "enhancement", "question"];

export const duplicateCheckedLabelList = ["duplicate", "unique"];

// Fetches a list of all Comments for an Issue
export async function fetchMessages(context:any) {
  const response = await fetch(context.payload.issue.comments_url);

  if (!response.ok) {
    const errorMessage = `An error has occured: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const messages = await data.map( (n:any) => {
    return {
      role: n.user.login === 'scaleforce[bot]' ? 'assistant' : 'user',
      content: n.body,
    }
  });

  return messages
};

// Fetches a File from a GitHub Repository 
export async function fetchRepo(context:any) {
  const response = await fetch(context.payload.issue.repository_url);

  if (!response.ok) {
    const errorMessage = `An error has occured: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const repoInfo = {
    name: "ScaleForce", // await data.name,
    owner: "ScaleForceAgency", // await data.owner,
    path: ".github/UserNoAiYesTemplates/ISSUE_TEMPLATE/bug-issue.yml"
  }

  return repoInfo
};

// Applies a Label to an Issue
export async function addLabel(label: string, context:any) {
  context.octokit.issues.addLabels(
    context.issue({
      labels: [label],
    })
  );
}

// Removes a Label to an Issue
export async function removeLabel(label: string, context:any) {
  context.octokit.issues.removeLabel(
    context.issue({
      labels: [label],
    })
  );
}
