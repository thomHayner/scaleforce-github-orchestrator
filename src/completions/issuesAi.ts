import { complete } from "../llm/index.js";
import type { LlmMessage, LlmTool } from "../llm/index.js";
import {
  primaryLabelList,
  addLabel,
} from '../utils/issuesUtils.js';

const HANDLER = "issuesai";

const systemPrompt:string = `\
  You are an intelligent Software Engineer working as a GitHub Repository Maintainer on an open source project.\n
  \n
  You are responsible for:\n
    - Management and moderation of the Issues, Discussions and Pull Requests Features.\n
    - Code reviews\n
  \n
  Only answer questions related to your role and it's responsibilities.\
`
const taskPrompt:string = `\
  Your task involves the Issues feature, which GitHub describes in the following way: \
  "Issues integrate lightweight task tracking into your repository. \
  Keep projects on track with issue labels and milestones, and reference them in commit messages."\n
  \n
  ## Your Responsibilities Relating to Issues\n
    - Analyze new issues and triage them.\n
    - If an issue is missing key information, you will ask follow up questions.\n
    - Apply an appropriate primary label to new issues, some issues may have additional secondary labels.\n
    - Create an official Issue Report based on a template that corresponds with the primary label.\n
    - Compare new issues to existing issues (both open and closed) to determine if the new issue is a duplicate.\n
    - If a new issue is a duplicate you will add the secondary label "duplicate" and reference the new issue with a comment in the existing issue's conversation.\n
    - Monitor issues and comments for inappropriate language; if an issue or comment contains questionable content you will hide the message from public view and notify human moderators for follow up.\n
    - Close stale issues after a predetermined length of time.\n
  \n
  ## Labels\n
  ### Primary Labels\n
  - bug\n
  - documentation\n
  - enhancement\n
  - question\n
  \n
  ### Secondary Labels\n
  - duplicate\n
  - good first issue\n
  - help wanted\n
  - invalid\n
  - wontfix\n
  \n
  ## Issue Reports\n
  - The Issue Report templates are stored in .yml files. The template will be provided after you pick a primary label\n
  - Each primary label has a corresponding template.\n
  \n
  ## Issue Intake Process
  The next message will contain a new issue. Follow these steps to complete the intake process:\n
  1. Aanalyze the new issue.\n
    - If there is enough information in the issue comments you should pick an appropriate primaryLabel, otherwise, ask follow up questions until you can pick an appropriate primaryLabel.\n
  2. After you have picked a primaryLabel, call the addLabel function to add the primaryLabel to the issue.\n
  3. Call the getReportTemplate function to get the reportTemplate that corresponds with the primaryLabel.\n
  4. Compare the issue comments and the reportTemplate to determine if you have enough information for completing the entire reportTemplate.\n
    - If there is enough information in the issue comments you should respond with an officialReport that conforms to the reportTemplate, otherwise, ask follow up questions until you have all of the necessary information for generating the officialReport.
  5. After picking a primaryLabel and generating an officialReport,
`

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const addPrimaryLabelTool: LlmTool = {
  name: "addLabel",
  description: "Apply the chosen primary label to the issue.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["primaryLabel"],
    properties: {
      primaryLabel: {
        type: "string",
        enum: [...primaryLabelList],
        description: "The Primary Label to apply to the Issue.",
      },
    },
  },
};

function buildBaseMessages(context: any, extra: LlmMessage[] = []): LlmMessage[] {
  const issue = context.payload.issue;
  const labels = issue.labels && issue.labels.length > 0
    ? 'Labels: ' + issue.labels.map((n: any) => n.name).join(', ') + ' '
    : '';
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: taskPrompt },
    { role: 'user', content: `${labels}${issue.title}: ${issue.body}` },
    ...extra,
  ];
}

export async function primaryLabelCompletion(context:any, messageList:any) {
  const messages = buildBaseMessages(context, messageList);

  const first = await complete(
    {
      model: 'gpt-4o',
      messages,
      tools: [addPrimaryLabelTool],
    },
    { handler: HANDLER },
  );

  let aiResponse = "";

  if (first.finishReason === "tool_calls" && first.toolCalls.length > 0) {
    const call = first.toolCalls[0];
    const args = JSON.parse(call.arguments);
    const primaryLabel: string = String(args.primaryLabel);

    await addLabel(primaryLabel, context);

    const followUp: LlmMessage[] = [
      ...messages,
      {
        role: 'assistant',
        content: first.content,
        toolCalls: first.toolCalls,
      },
      {
        role: 'tool',
        toolCallId: call.id,
        content: JSON.stringify({ primaryLabel }),
      },
      {
        role: 'user',
        content: `Use the following .yml template to generate an official report:\n
                name: Bug report\n
                description: Report a bug or an issue that isn't working as expected.\n
                title: "[BUG]: <Provide a clear, descriptive title>"\n
                labels: ["bug"]\n
                assignees: []\n
                \n
                body:\n
                  - type: markdown\n
                    attributes:\n
                      value: |\n
                        Please fill out the following information to help us resolve the issue.\n
                \n
                  - type: input\n
                    id: description\n
                    attributes:\n
                      label: Describe the bug\n
                      description: A clear and concise description of what the bug is.\n
                      placeholder: "Describe the bug in detail..."\n
                \n
                  - type: textarea\n
                    id: steps\n
                    attributes:\n
                      label: Steps to reproduce\n
                      description: |\n
                        Steps to reproduce the behavior:\n
                        1. Use branch named '...'\n
                        2. Go to file '...'\n
                        3. Find property named '...'\n
                        4. Change '...'\n
                        5. Run program using command '...'\n
                        6. See error
                      placeholder: "List the steps to reproduce the bug..."\n
                \n
                  - type: input\n
                    id: expected\n
                    attributes:\n
                      label: Expected behavior\n
                      description: What you expected to happen.\n
                      placeholder: "What was the expected result?"\n
                \n
                  - type: input\n
                    id: actual\n
                    attributes:\n
                      label: Actual behavior\n
                      description: What actually happened instead.\n
                      placeholder: "What happened instead?"\n
                \n
                  - type: dropdown\n
                    id: branch\n
                    attributes:\n
                      label: Branch\n
                      description: Specify the branch you were using when the bug occurred.\n
                      options:\n
                        - main\n
                        - other\n
                \n
                  - type: input\n
                    id: otherBranch\n
                    attributes:\n
                      label: Branch name\n
                      description: If you selected 'other' branch for the previous question, what is the branch name?\n
                      placeholder: "what-is-the-name-of-the-branch-you-were-using"\n
                \n
                  - type: input\n
                    id: pythonVersion\n
                    attributes:\n
                      label: Python version\n
                      description: Specify the version of Python you were using when the bug occurred.\n
                      placeholder: "e.g., 3.12.5(64b)"\n
                \n
                  - type: input\n
                    id: llm\n
                    attributes:\n
                      label: LLM Used\n
                      description: Specify the LLM provider you were using when the bug occurred.\n
                      placeholder: "e.g., ChatGPT"\n
                \n
                  - type: input\n
                    id: model\n
                    attributes:\n
                      label: Model used\n
                      description: Specify the LLM model you were using when the bug occurred.\n
                      placeholder: "e.g., GPT-4o-mini"\n
                \n
                  - type: textarea\n
                    id: additional\n
                    attributes:\n
                      label: Additional context\n
                      description: Add any other context about the problem here.\n
                      placeholder: "Any additional information..."\n
      `,
      },
    ];

    const next = await complete(
      { model: 'gpt-4o', messages: followUp, tools: [addPrimaryLabelTool] },
      { handler: HANDLER },
    );
    aiResponse += next.content ?? "";
  } else {
    aiResponse += first.content ?? "";
  }

  return aiResponse;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function issueReportCompletion(context:any, messages:any, _primaryLabel?:string, _template?:any) {
  const result = await complete(
    {
      model: 'gpt-4o-mini',
      messages: buildBaseMessages(context, messages),
    },
    { handler: HANDLER },
  );
  return result.content ?? "";

  // There needs to be an abort here, something that checks if the conversation should be over and stops responding
  // There should also be something that checks to make sure it is appropriate to respond at all, for instance, if a user specifically sends a message to someone else the bot should not respond
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function issueDuplicateCheckCompletion(context:any, messages:any) {
  const result = await complete(
    {
      model: 'gpt-4o',
      messages: buildBaseMessages(context, messages),
    },
    { handler: HANDLER },
  );
  return result.content ?? "";

  // There needs to be an abort here, something that checks if the conversation should be over and stops responding
  // There should also be something that checks to make sure it is appropriate to respond at all, for instance, if a user specifically sends a message to someone else the bot should not respond
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function issueCommentCompletion(context:any, messages:any) {
  const result = await complete(
    {
      model: 'gpt-4o',
      messages: buildBaseMessages(context, messages),
    },
    { handler: HANDLER },
  );
  return result.content ?? "";

  // There needs to be an abort here, something that checks if the conversation should be over and stops responding
  // There should also be something that checks to make sure it is appropriate to respond at all, for instance, if a user specifically sends a message to someone else the bot should not respond
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
