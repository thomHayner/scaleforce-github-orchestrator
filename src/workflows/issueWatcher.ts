import { issueCommentCompletion } from "../completions/issuesAi.js";

export default async function issueCommentCreated(context: any): Promise<any> {
  // // // ChatGPT check/analyze for duplicate issues, add tags

  ///// Fetch all previous comments and turn them into a conversation using OpenAI Completion format:
  async function fetchMessages() {
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
  fetchMessages().catch(error => {
    error.errorMessage;
  });

  const messages = await fetchMessages();

  ///// Get an OpenAI chat completion based on the entire conversation so far:
  let aiResponseMessage = await issueCommentCompletion(context, messages);

  ///// If the agent decided on a 'primary label':
  if (aiResponseMessage.includes("PRIMARY_LABEL: ")) {
    const primaryLabel = "bug";
    // FIXME: hardcoded owner/repo/issue from initial scaffolding; replace with context.issue() and fix `issue_numbner` typo before enabling.
    await context.octokit.rest.issues.addLabels({ owner: "thomHayner", repo: "scaleforce-github-orchestrator", issue_numbner: "32", labels: [primaryLabel] });

    /// Fetch the repo details to feed into Octokit:
    async function fetchRepo() {
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
    fetchRepo().catch(error => {
      error.errorMessage;
    });

    const repoInfo = await fetchRepo();
    const owner = await repoInfo.owner;
    const name = await repoInfo.name;
    const path = await repoInfo.path;

    /// Have octokit grab the corresponding .yml template
    const template = await context.octokit.rest.repos.getContent({ owner, name, path });

    // add on a message telling gpt to use the template to make a report
    messages.push({
      role: 'user',
      content: 'reply with a copy of the template that I just provided in markdown format'
      // content: "Use the attached .yml template to write an official Issue Report based on the preceeding conversation. If you need more information to complete the form, ask follow up question; if you have all the necessary information, return the official Issue Report in markdown format.",
    })
    aiResponseMessage = await issueCommentCompletion(context, messages);

    // return the report
  } ;
  // Build a ProBot comment object as a respose to the incoming comment
  const issueComment = context.issue({
    body: aiResponseMessage,
  });
  return await issueComment
};
