import {
  primaryLabelCompletion,
  issueCommentCompletion,
  issueDuplicateCheckCompletion,
  issueReportCompletion
} from "../completions/issuesAi.js";
import {
  addLabel,
  duplicateCheckedLabelList,
  fetchMessages,
  primaryLabelList
} from "../utils/issuesUtils.js";

// const template = await context.octokit.rest.repos.getContent({ owner, name, path });
// fetchRepo().catch(error => {
//   error.errorMessage;
// });

export default async function issueOpenedIntake(context: any): Promise<any> {

  ///// If this is the first 'Intake Workflow' interaction from an issues.opened:
  if (context.name === 'issues' && context.payload.action === 'opened') {
    // Add the 'intake' Label to the new Issue
    await addLabel("intake", context);

    // Greet the user
    // TODO: add a community link (Discord/Slack/etc.) once decided.
    const greeting = `Hi there @${context.payload.sender.login}, thanks for opening this issue!\n\
    Give me a second to classify the issue, apply labels, and see if I have any follow up questions before writing an official report.`;
    const greetingParams = context.issue({
      body: greeting,
    });
    await context.octokit.issues.createComment(greetingParams);
  
    // AI: apply Primary Label step
    const messageList = await fetchMessages(context);
    // fetchMessages(context:any).catch(error => {
    //   error.errorMessage;
    // });

    const aiResponseMessage = await primaryLabelCompletion(context, messageList);
    const issueComment = context.issue({
      body: aiResponseMessage,
    });
    
    return await issueComment;
  }

  ///// If responding to a user comment && NOT primaryLabel:
  else if (
    !context.payload.issue.labels.map((n:any)=>n.name).some((option:string) => primaryLabelList.includes(option))
  ) {
    // AI: apply Primary Label step
    const messageList = await fetchMessages(context);
    // fetchMessages(context:any).catch(error => {
    //   error.errorMessage;
    // });

    const aiResponseMessage = await primaryLabelCompletion(context, messageList);
    const issueComment = context.issue({
      body: aiResponseMessage,
    });
    
    return await issueComment;
  }

  ///// If responding to a user comment && HAS primaryLabel && NOT duplicateCheckedLabel:
  else if (
    context.payload.issue.labels.map((n:any)=>n.name).some((option:string) => primaryLabelList.includes(option)) && 
    !context.payload.issue.labels.map((n:any)=>n.name).some((option:string) => duplicateCheckedLabelList.includes(option))
  ) {
    // AI: check/analyze for Duplicate Issues step
    const messageList = await fetchMessages(context);
    // fetchMessages(context:any).catch(error => {
    //   error.errorMessage;
    // });

    const aiResponseMessage = await issueDuplicateCheckCompletion(context, messageList);
    const issueComment = context.issue({
      body: aiResponseMessage,
    });
    
    return await issueComment;
  }

  ///// If responding to a user comment && HAS primaryLabel && HAS duplicateCheckedLabel:
  else if (
    context.payload.issue.labels.map((n:any)=>n.name).some((option:string) => duplicateCheckedLabelList.includes(option)) && 
    context.payload.issue.labels.map((n:any)=>n.name).some((option:string) => primaryLabelList.includes(option))
  ) {
  // AI: generate official bug report
    const messageList = await fetchMessages(context);
    // fetchMessages(context:any).catch(error => {
    //   error.errorMessage;
    // });

    const aiResponseMessage = await issueReportCompletion(context, messageList);
    const issueComment = context.issue({
      body: aiResponseMessage,
    });
    
    return await issueComment;
  };

  // If this is a follow up question before the 'Official Bug Report is completed"
  if (context.payload.issue.labels.length === 1 && context.payload.issue.labels.includes("intake")) {

  };

  // POSSIBLY---
  // - ask follow up questions
  // - edit the user's initial non-templated comment to reformat it into the appropriate template
  // - respond with FAQ answers to common questions
};

