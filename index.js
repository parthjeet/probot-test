const { Context } = require('probot');
const yaml = require('js-yaml');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log.info("Yay, the app was loaded!");
  const x = getUserStoriesList("[US21312,US23223]")
  const array1 = ["US21312","US23223"]
  const array2 = ["US21312","US23223","US46544"]
  const filteredArray = array1.filter(value => array2.includes(value));
  app.log.info(String(Array.from(filteredArray)))

  app.on(['pull_request.opened', 'pull_request.edited','pull_request.reopened', 'pull_request.ready_for_review','pull_request.synchronize','pull_request.labeled'], async (context) =>{
    
    // read Release contract File
    // context.payload.pull_request.base.ref.startsWith()

    try {
      // parse release contract file
      // Release Contract stuff below
      const repo_json = context.repo({ path: 'release-contract.yml' }); //this gives you the path, owner of the source repo
      const release_contract_content_response_json = await context.octokit.repos.getContent({ owner: `${repo_json.owner}`, repo: `${repo_json.repo}`, path: 'release-contract.yml' });
      const release_contract_content_utf8 = Buffer.from(release_contract_content_response_json.data.content, 'base64').toString('utf8')
      const release_contract_yamp_obj = yaml.load(release_contract_content_utf8)
      
      var release_name_string = release_contract_yamp_obj['Release']
      const release_contract_features_array = Array.from(release_contract_yamp_obj['Features'])
      var release_contract_user_stories_array = new Array()
      release_contract_features_array.forEach(feature => {
        var feature_user_stories_array = Array.from(feature['UserStories'])
        feature_user_stories_array.forEach(user_story =>{
          release_contract_user_stories_array.push(user_story)
        })
      })

      // Pull Request stuff below
      // read PR content- title and body
      const pr_content_payload = context.payload.pull_request.title.concat('\n', context.payload.pull_request.body)
      // search for artifact pattern
      const pr_user_stories_list = Array.from(getUserStoriesList(pr_content_payload))
      
      // const issueComment = context.issue({
      //   body: `owner: ${repo_json.owner} repo: ${repo_json.repo} path: ${repo_json.path} Features: ${release_contract_user_stories_array.toString()}`,
      // });
      // return context.octokit.issues.createComment(issueComment);

      // Initialize a Check Run
      let checkRun = await createCheckRun(context, repo_json.owner, repo_json.repo)

      // Process Check Logic
      let result = await chekLogic(context, release_contract_user_stories_array, pr_user_stories_list)

      // Update Check with Resolution
      await resolveCheck(context, checkRun, result, repo_json.owner, repo_json.repo)


    } catch (error) {
      app.log.debug(error)
      const issueComment = context.issue({
        body: `Repo not found !!`,
      })
      return context.octokit.issues.createComment(issueComment); 
    }
    



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

async function createCheckRun(context, source_repo_owner, source_repo) {
    
  const startTime = new Date();
  let headSha = context.payload.pull_request.head.sha

  return await context.octokit.checks.create({
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: source_repo_owner,
    repo: source_repo,
    name: "Probot CI Test",
    status: "queued",
    started_at: startTime,
    head_sha: headSha,
    output: {
      title: "Queuing Probot CI Test",
      summary: "The Probot CI Test will begin shortly",
    },
  })
}

async function chekLogic(context, rc_us_array, pr_us_array) {
  // await new Promise(r => setTimeout(r, 5000));
  const filteredArray = Array.from(rc_us_array.filter(value => pr_us_array.includes(value)));
  if(filteredArray.length > 0){
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
    name: "Probot CI Test",
    check_run_id: checkRun.data.id,
    status: "completed",
    head_sha: headSha,
    conclusion: result,
    output: {
      title: "Probot CI Test Complete",
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
   const user_stories_regex = /[US|us].[0-9]*/gm;
   return message.match(user_stories_regex);
}

// /**
//  * @description determine if an array contains one or more items from another array.
//  * @param {Array} haystack the array to search.
//  * @param {Array} arr the array providing items to check for in the haystack.
//  * @return {boolean} true|false if haystack contains at least one item from arr.
//  */
//  const findOne = (haystack, arr) => {
//   return arr.some(v => haystack.includes(v));
// };


