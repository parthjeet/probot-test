const { Context } = require('probot');
const yaml = require('js-yaml');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log.info("Yay, the app was loaded!");
  
  app.on(['pull_request.opened', 'pull_request.edited','pull_request.reopened', 'pull_request.ready_for_review','pull_request.synchronize','pull_request.labeled','check_run.rerequested'], async (context) =>{
    let check_status = "skipped"
    var checkRun

    try {
      // create check run
      if(context.payload.action != "rerequested"){
        checkRun = await createCheckRun(context)
      }
      else{
        checkRun = {"data":{"id":context.payload.check_run.id}}
      }
    } catch (error) {
      app.log.debug(error)
      check_status = "skipped"
    }
    try {
      // execute check run
      check_status = await chekLogic(context)
    } catch (error) {
      app.log.debug(error)
      check_status = "failure"
    }
    finally {
      // finalize check run
      app.log.debug("Entering Finally")
      await resolveCheck(context, checkRun, check_status)
    } 

  });

};

async function createCheckRun(context) {
  var repo_json = context.repo({ path: 'release-contract.yml' }); //this gives you the path, owner of the source repo 
  const startTime = new Date();
  let headSha = context.payload.pull_request.head.sha

  return await context.octokit.checks.create({
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: repo_json.owner,
    repo: repo_json.repo,
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

async function chekLogic(context) {
  // release contract stuff below
  var repo_json = context.repo({ path: 'release-contract.yml' });
  var release_contract_user_stories_array = new Array()
  var release_contract_content_response_json
  try {
    release_contract_content_response_json = await context.octokit.repos.getContent({ owner: `${repo_json.owner}`, repo: `${repo_json.repo}`, path: 'release-contract.yml' });
  } catch (error) {
    check_status = "failure"
    throw error
  }
  
  const release_contract_content_utf8 = Buffer.from(release_contract_content_response_json.data.content, 'base64').toString('utf8')
  var release_contract_yamp_obj = yaml.load(release_contract_content_utf8)
  var release_name_string = release_contract_yamp_obj['Release']
  const release_contract_features_array = Array.from(release_contract_yamp_obj['Features'])
  release_contract_features_array.forEach(feature => {
    var feature_user_stories_array = Array.from(feature['UserStories'])
    feature_user_stories_array.forEach(user_story =>{
      release_contract_user_stories_array.push(user_story)
    })
  })

  // pr stuff below
  var pr_user_stories_list = new Array()
  const pr_content_payload = await getPrPayload(context)
  if(getUserStoriesList(pr_content_payload) != null){
    pr_user_stories_list = Array.from(getUserStoriesList(pr_content_payload))
  }
  else{
    return "failure"
  }

  // comparing release-contract and PR
  const filteredArray = Array.from(release_contract_user_stories_array.filter(value => pr_user_stories_list.includes(value)));
  if(filteredArray.length > 0 && filteredArray.length == pr_user_stories_list.length){
    return "success"
  }
  return "failure"
}

async function resolveCheck(context, checkRun, check_status) {
  var repo_json = context.repo({ path: 'release-contract.yml' }); //this gives you the path, owner of the source repo 
  let headSha
  if(context.payload.pull_request != null){headSha = context.payload.pull_request.head.sha}
  else {
    var pr = await context.octokit.request({method: "GET", url: context.payload.check_run.check_suite.pull_requests[0].url})
    headSha = await pr.data.head.sha
  }
  await context.octokit.checks.update({
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: repo_json.owner,
    repo: repo_json.repo,
    name: "release-contract probot check",
    check_run_id: checkRun.data.id,
    status: "completed",
    head_sha: headSha,
    conclusion: check_status,
    output: {
      title: "Release Contract check complete.",
      summary: "Result is " + check_status,
    },
  })
}

function getUserStoriesList(message){
   const user_stories_regex = /(US|us).[0-9]*/gm;
   return message.match(user_stories_regex);
}

async function getPrPayload(context){
  if(context.payload.pull_request == null){
    var pr = await context.octokit.request({method: "GET", url: context.payload.check_run.check_suite.pull_requests[0].url})
    if(pr.data.body==null){pr.data.body = ""}
    return pr.data.title.concat('\n', pr.data.body)
  }
  if(context.payload.pull_request.body == null) {context.payload.pull_request.body = ""}
  return context.payload.pull_request.title.concat('\n', context.payload.pull_request.body)
}
