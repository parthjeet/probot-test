const { Context } = require('probot');
const yaml = require('js-yaml');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log.info("Yay, the app was loaded!");
  
  app.on(['pull_request.opened', 'pull_request.edited','pull_request.reopened', 'pull_request.ready_for_review','pull_request.synchronize','pull_request.labeled'], async (context) =>{
    let release_contract_yamp_obj, repo_json
    var release_contract_user_stories_array = new Array()
    var pr_user_stories_list = new Array()
    try {
      // Release Contract stuff below
      // parse release contract file
      repo_json = context.repo({ path: 'release-contract.yml' }); //this gives you the path, owner of the source repo
      const release_contract_content_response_json = await context.octokit.repos.getContent({ owner: `${repo_json.owner}`, repo: `${repo_json.repo}`, path: 'release-contract.yml' });
      const release_contract_content_utf8 = Buffer.from(release_contract_content_response_json.data.content, 'base64').toString('utf8')
      release_contract_yamp_obj = yaml.load(release_contract_content_utf8)
    } catch (error) {
      app.log.debug(error)
      const issueComment = context.issue({
        body: `unable to read release-contract.yml`,
      })
      return context.octokit.issues.createComment(issueComment); 
    }

    try{
      var release_name_string = release_contract_yamp_obj['Release']
      const release_contract_features_array = Array.from(release_contract_yamp_obj['Features'])
      release_contract_features_array.forEach(feature => {
        var feature_user_stories_array = Array.from(feature['UserStories'])
        feature_user_stories_array.forEach(user_story =>{
          release_contract_user_stories_array.push(user_story)
        })
      })
    }catch(error){
      app.log.debug(error)
      const issueComment = context.issue({
        body: `Parsing error in release-contract.yml`,
      })
      return context.octokit.issues.createComment(issueComment); 
    }

      // Pull Request stuff below
      // read PR content- title and body
      try{
      const pr_content_payload = context.payload.pull_request.title.concat('\n', context.payload.pull_request.body)
      
      
      // search for artifact pattern
      pr_user_stories_list = Array.from(getUserStoriesList(pr_content_payload))
      } catch(error) {
        app.log.debug(error)
        const issueComment = context.issue({
          body: `Pull Request parsing error`,
        })
        return context.octokit.issues.createComment(issueComment); 
      }
      try{
      // Initialize a Check Run
      let checkRun = await createCheckRun(context, repo_json.owner, repo_json.repo)

      // Process Check Logic
      let result = await chekLogic(context, release_contract_user_stories_array, pr_user_stories_list)

      // Update Check with Resolution
      await resolveCheck(context, checkRun, result, repo_json.owner, repo_json.repo, app)
      }catch(error){
        app.log.debug(error)
        await resolveCheck(context, checkRun, 'skipped', repo_json.owner, repo_json.repo)
      }

  });

};

async function createCheckRun(context, source_repo_owner, source_repo) {
    
  const startTime = new Date();
  let headSha = context.payload.pull_request.head.sha

  return await context.octokit.checks.create({
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: source_repo_owner,
    repo: source_repo,
    name: "release-contract probot check",
    status: "queued",
    started_at: startTime,
    head_sha: headSha,
    output: {
      title: "Queuing release-contract probot check",
      summary: "The release-contract probot check will begin shortly",
    },
  })
}

async function chekLogic(context, rc_us_array, pr_us_array, app) {
  const filteredArray = Array.from(rc_us_array.filter(value => pr_us_array.includes(value)));
  if(filteredArray.length > 0 && filteredArray.length == pr_us_array.length){
    return "success"
  }
  
  
  
  return "failure"
}

async function resolveCheck(context, checkRun, result, source_repo_owner, source_repo) {
  let headSha = context.payload.pull_request.head.sha
  
  await context.octokit.checks.update({
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: source_repo_owner,
    repo: source_repo,
    name: "release-contract probot check",
    check_run_id: checkRun.data.id,
    status: "completed",
    head_sha: headSha,
    conclusion: result,
    output: {
      title: "Release Contract check complete.",
      summary: "Result is " + result,
    },
  })
}

/**
 * Returns an array of User Stories from the message parameter
 * @param {String} message
 * @returns {Array} Array of user stories present in the message string
 */
function getUserStoriesList(message){
   const user_stories_regex = /(US|us).[0-9]*/gm;
   return message.match(user_stories_regex);
}
