const { Context } = require('probot');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    // const issueComment = context.issue({
    //   body: "Thanks for opening this issue!",
    // });
    // return context.octokit.issues.createComment(issueComment);
    try {
      const repo_json = context.repo({ path: 'blah.yml' })
      const issueComment = context.issue({
        body: `owner: ${repo_json.owner} `,
      })
      return context.octokit.issues.createComment(issueComment);
    } catch (error) {
      const issueComment = context.issue({
        body: `Repo not found !!`,
      })
      return context.octokit.issues.createComment(issueComment); 
    }
    
  });

  app.on("pull_request.opened", async (context) =>{
    const repo_json = context.repo({ path: 'release-contract.yml' })
    const issueComment = context.issue({
      body: `${repo_json.owner}`,
    });
    return context.octokit.issues.createComment(issueComment);

    // read Release contract File
    // context.payload.pull_request.base.ref.startsWith()

    
    

    // context.octokit.repos.getContent()
    // context.repo()


    // parse release contract file

    // read PR content- title and body
    // search for artifact pattern

    // if not found: POST a Comment, fail merge

    // if found:
    //   match the found artifact to parsed release contract
    //   if not found: post a comment, fail merge
    //   if found: pass test

  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
