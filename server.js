// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const util = require('util');
const fs = require('fs');
const fetch = require('node-fetch');
const bp = require('body-parser');
const svgLabels = require('svg-labels');
const url = require('url');

// List of repositories handled by the Media WG.
const repos = [
  "w3c/audio-session",
  "w3c/autoplay",
  "w3c/charter-media-wg",
  "w3c/encrypted-media",
  "w3c/media-capabilities",
  "w3c/media-playback-quality",
  "w3c/mediasession",
  "w3c/media-source",
  "w3c/media-wg",
  "w3c/picture-in-picture",
  "w3c/webcodecs"
];

const repo_url_prefix = "https://api.github.com/repos/";

function ghFetch(api, data) {
    const ghAPI = `https://${
      process.env.GITHUB_USER
    }:${
      process.env.GITHUB_KEY
    }@api.github.com`;
    const headers = new fetch.Headers({
      Accept: 'application/vnd.github.inertia-preview+json',
      'Content-Type': 'application/json'
    });
    return fetch(`${ghAPI}${api}`, {
      headers,
      method: 'GET',
      body: data && JSON.stringify(data)
    })
    .then(response => response.json())
    .catch(e => console.log(e))
}

// Returns the repo list ending with a "+".
function repoListForSearchString() {
  let result = "";
  repos.forEach(repo => {
    result += "repo:" + repo + "+";
  });
  return result;
}

/* Index */
app.get("/agenda", bp.urlencoded({ extended: false }), async (req, res) => {
  const label = req.query.label || 'agenda';
  const command = req.query.command || '/agenda';
  const data = {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Find all the tagged issues.
  const repoString = repoListForSearchString();
  const searchResults = (await ghFetch(`/search/issues?q=${repoString}label:"${label}"&sort=created&order=asc&per_page=100`));
  if (!searchResults.items) console.log(searchResults);
  if (searchResults.items) {
    searchResults.items.forEach(issue => data[issue.number] = issue);
  }

  // Filter into the just the data we want
  const keys = Object.keys(data);
  for (const k of keys) {
    const oldData = data[k];
    // console.log(oldData);
    const comment = (await ghFetch(new url.URL(data[k].comments_url).pathname))
    .filter(comment => comment.body.match(new RegExp(`(^|\n)\\s*${command}`,'i')))
    .pop();

    data[k] = {
      title: oldData.title,
      user: oldData.user.login,
      state: oldData.state,
      number: k,
      labels: oldData.labels,
      comments: oldData.comments,
      body: oldData.body,
      closedAt: oldData.closed_at,
      repo: oldData.repository_url.substring(repo_url_prefix.length),
      milestone: oldData.milestone && oldData.milestone.title,
      milestoneURL: oldData.milestone && oldData.milestone.url,
      url: oldData.html_url,
      request_comment: comment,
      requester: comment && comment.user.login
    }
  }

  res.json(data);
});

app.get("/helpwanted", async function (req,res) {
  const repoString = repoListForSearchString();
  const data = (await ghFetch(
    `/search/issues?q=${repoString}state:open+label:"help wanted"&sort=created&order=asc&per_page=100`
  ))
  .items.map(i => {
    return {
      title: i.title,
      number: i.number,
      repo: i.repository_url.substring(repo_url_prefix.length),
      url: i.html_url,
      labels: i.labels,
      state: i.state,
      milestone: i.milestone && i.milestone.title,
      milestoneURL: i.milestone && i.milestone.url
    }
  }).filter(i => i.state === 'open');

  res.json(data);
});

app.use('/svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.send(svgLabels(req.query));
})

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.use(express.static('node_modules/html5-boilerplate/dist'));
app.use(express.static('node_modules/github-markdown-css'));

app.use(function (req, res) {
  res.status(404).sendFile(__dirname + '/node_modules/html5-boilerplate/dist/404.html');
});

const port = process.env.PORT || 8080;

const listener = app.listen(port, () => {
  console.log(`Your app is listening on port ${listener.address().port}`)
});
