const express = require('express');
const app = express();

// Google apis
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
// const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const { ppid } = require('process');
const { chownSync } = require('fs');
// const sheetID = "1ngG68qH2T6kgX0kcoHl9D2nXsPttczLZTYtdYemntas";
const sheetID = "1d6HuoQx30z-GpdBZaBqanlQ2ZSuPxbHx87g49wWy2Sc"
const sheets = google.sheets('v4');
var service;
var authClient;

var physicsFlashcards = [];
var mathsFlashcards = [];
var compSciFlashcards = [];

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  console.log(TOKEN_PATH)
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await new google.auth.GoogleAuth({
    scopes: SCOPES,
    keyFile: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// function formatSequence(sequence) {
// var qImage;
//   for (x in sequence) {
//     qImage = "";
//     for (let i=2; i<=5; i++) {
//       qImage += sequence[x][i]
//     }
//     sequence[x] = [sequence[x][0], sequence[x][1], qImage, ...sequence[x].slice(6)]
//   }
// return(sequence)
// }

async function readSubjectCards(authClient) {
  const request = {
    spreadsheetId: sheetID,
    auth: authClient,
    ranges: ["Physics!A:Y", "Maths!A:Y", "CompSci!A:Y"] // range: SheetName!Start:Stop
  }
  try {
    const response = (await sheets.spreadsheets.values.batchGet(request)).data;
    var data = JSON.parse(JSON.stringify(response, null, 2)).valueRanges;
    physicsFlashcards = data[0].values.slice(1);
    console.log(physicsFlashcards)
    mathsFlashcards = data[1].values.slice(1);
    console.log(mathsFlashcards)
    compSciFlashcards = data[2].values.slice(1);
    console.log(compSciFlashcards)
  } catch (err) {
    console.error(err);
  }
}

function topicsReader(list, topics) {
  // console.log(list)
  // var count = 0
  // console.log(topics)
  var subjectTopics = {}
  for (i of list) {
    var topic = i[0]
    var topicNumber = topics.indexOf(topic)
    if (topicNumber < 10) {
      topicNumber = `0${topicNumber}`
    }
    if (subjectTopics[topicNumber] == undefined) {
        subjectTopics[topicNumber] = []
    }
    subjectTopics[topicNumber].push(i)
  }
  // console.log(count)
  return subjectTopics
}

function indexToArray(topicsIndex, subjectTopicList) {
  var indexDeck = []
  var maxIndex = topicsIndex.length-2;
  for (let count=0;count <= maxIndex; count+=2) {
      var index = topicsIndex.slice(count, count+2)
      indexDeck.push(index)
  }
  var cardDeck = [];
  if (indexDeck.length > 1) {
    for (i of indexDeck) {
      cardDeck.push(...(subjectTopicList[i]))
    } 
  } else if (indexDeck.length === 1) {
      cardDeck = subjectTopicList[indexDeck[0]]
  }
  return cardDeck
}

// Reload data
function reloadData(interval) {
  setTimeout( async () => {
    await readSubjectCards(authClient)
    console.log("DATA RELOADED")
    reloadData(600000)
  },  interval )
}
// data
var physicsTopicList, physicsTopics;
var mathsTopicList, mathsTopics;
var compSciTopicList, compSciTopics;

authorize().then( async (client) => {
  authClient = client
  service = google.sheets({version: 'v4', auth: authClient});
  await readSubjectCards(authClient);
  fs.readFile("./SubjectTopics.json").then( (res) => {
    const SubjectTopics = JSON.parse(res)
    physicsTopicList = SubjectTopics[0];
    mathsTopicList = SubjectTopics[1];
    compSciTopicList = SubjectTopics[2];

    physicsTopics = topicsReader(physicsFlashcards, physicsTopicList);
    mathsTopics = topicsReader(mathsFlashcards, mathsTopicList);
    compSciTopics = topicsReader(compSciFlashcards, compSciTopicList);
  } )
  .catch( (err) => {
    throw err
  } )

  app.listen(8080);
  console.log("Listening on port 8080");
  }).catch(console.error);


// Google Sheets Constants
const physicsSheetId = 0;
const mathsSheetId = 601486212;
const compSciSheetId = 370484391;

// Google api authorisation
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

//Middleware
app.set('view engine', 'ejs');
app.set('views', './' );
app.use( express.static('public') );
app.use(express.json())

//Directories
app.get( "/" , (req, res) => {
    res.redirect("/Physics/Topic")
})

app.get("/Physics/Topic", (req, res) => {
    var topicArray = [];
    for (i in physicsTopics) {
      var index = parseInt(i)
      var topic = physicsTopicList[index]
      topicArray.push([i, topic])
    }
    res.render("Topic",{ Subject: "Physics", topics: topicArray})
})

app.get("/Maths/Topic", (req, res) => {
  var topicArray = [];
  for (i in mathsTopics) {
    var index = parseInt(i)
    var topic = mathsTopicList[index]
    topicArray.push([i, topic])
  }
    res.render("Topic",{ Subject: "Maths", topics: topicArray})
})

app.get("/CompSci/Topic", (req, res) => {
  var topicArray = [];
  for (i in compSciTopics) {
    var index = parseInt(i)
    var topic = compSciTopicList[index]
    topicArray.push([i, topic])
  }
    res.render("Topic",{ Subject: "Computer Science", topics: topicArray})
})

app.get("/Physics/Topic/:topics", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, physicsTopics);
  res.render("Home", {Flashcards: JSON.stringify(cardDeck), Subject: "Physics"})
})

app.get("/Maths/Topic/:topics", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, mathsTopics);
  res.render("Home", {Flashcards: JSON.stringify(cardDeck), Subject: "Maths"})
})

app.get("/CompSci/Topic/:topics", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, compSciTopics);
  console.log(cardDeck)
  res.render("Home", {Flashcards: JSON.stringify(cardDeck), Subject: "Computer Science"})
})

app.get("/Physics", (req, res) => {
    res.render("Home", {Flashcards: JSON.stringify(physicsFlashcards), Subject: "Physics"})
})
app.get( "/Physics/cards", (req, res) => {
    res.render("FlashCards", {Flashcards: JSON.stringify(physicsFlashcards), Subject: "Physics", topics: physicsTopicList})
})
app.get( "/Physics/topic/:topics/cards", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, physicsTopics);
  res.render("FlashCards", {Flashcards: JSON.stringify(cardDeck), Subject: "Physics", topics: physicsTopicList})
})
app.get("/Maths", (req, res) => {
    res.render("Home", {Flashcards: JSON.stringify(mathsFlashcards), Subject: "Maths"})
})
app.get( "/Maths/cards", (req, res) => {
    res.render("FlashCards", {Flashcards: JSON.stringify(mathsFlashcards), Subject: "Maths", topics: mathsTopicList})
})
app.get( "/Maths/topic/:topics/cards", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, mathsTopics);
  res.render("FlashCards", {Flashcards: JSON.stringify(cardDeck), Subject: "Maths", topics: mathsTopicList})
})
app.get("/CompSci", (req, res) => {
    res.render("Home", {Flashcards: JSON.stringify(compSciFlashcards), Subject: "Computer Science"})
})
app.get( "/CompSci/cards", (req, res) => {
    res.render("FlashCards", {Flashcards: JSON.stringify(compSciFlashcards), Subject: "Computer Science", topics: compSciTopicList})
})
app.get( "/CompSci/topic/:topics/cards", (req, res) => {
  const topicsIndex = req.params.topics;
  var cardDeck = indexToArray(topicsIndex, compSciTopics);
  res.render("FlashCards", {Flashcards: JSON.stringify(cardDeck), Subject: "Computer Science", topics: compSciTopicList})
})
app.post( "/newFlashcard/:sub", (req, res) => {
    const subject = req.params.sub
    const values = req.body
    var rangeOfData;
    var JSvalues, qImage;
    console.log(subject)

    for (let i=1; i<=4; i++) {
      qImage += values[i]
    }
    JSvalues = [values[0], qImage, ...values.slice(5)]

    if (subject === "Physics") {
      rangeOfData = `${physicsFlashcards.length+2}:${physicsFlashcards.length+2}`
      physicsFlashcards.push(JSvalues)
    } else if (subject === "Maths") {
      rangeOfData = `${mathsFlashcards.length+2}:${mathsFlashcards.length+2}`
      mathsFlashcards.push(JSvalues)
    } else if (subject === "CompSci") {
      rangeOfData = `${compSciFlashcards.length+2}:${compSciFlashcards.length+2}`
      compSciFlashcards.push(JSvalues)
    }

    service.spreadsheets.values.update({
      spreadsheetId: sheetID,
      range: `${subject}!${rangeOfData}`,
      resource: {
        values: [values]
      },
      valueInputOption: "RAW"
    }).then( (result) => {
      console.log('%d cells updated.', result.data.updatedCells);
      res.end()
    }).catch( (err) => {throw err} )
})

app.post( "/modifyFlashcard/:sub", (req, res) => {
  const subject = req.params.sub
  const data = req.body
  var JSvalues, qImage;
  console.log(data.range)
  console.log(data.values)

  for (let i=1; i<=4; i++) {
    qImage += data.values[i]
  }
  JSvalues = [data.values[0], qImage, ...data.values.slice(5)]

  service.spreadsheets.values.update({
    spreadsheetId: sheetID,
    range: data.range,
    resource: {
      values: [data.values]
    },
    valueInputOption: "RAW"
  }).then( (result) => {
    if (subject === "Physics") {
      physicsFlashcards[data.index-2] = JSvalues
    } else if (subject === "Maths") {
      mathsFlashcards[data.index-2] = JSvalues
    } else if (subject === "CompSci") {
      compSciFlashcards[data.index-2] = JSvalues
    }
    console.log('%d cells updated.', result.data.updatedCells);
    res.end()
  }).catch( (err) => {throw err} )
})

app.delete("/delFlashcard/:sub", (req, res) => {
  // "deleteDimension" : {}

  const subject = req.body.subject
  const index = req.body.index
  console.log(index)
  var sheetId;

  switch(subject) {
    case "Physics":
      sheetId = physicsSheetId
      physicsFlashcards.splice(index-2, 1)
      break;
    case "Maths":
      sheetId = mathsSheetId
      mathsFlashcards.splice(index-2, 1)
      break;
    case "CompSci":
      sheetId = compSciSheetId
      compSciFlashcards.splice(index-2, 1)
      break;
  }

  const batchUpdateRequest = {
    requests: [{deleteDimension : {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: index-1,
          endIndex: index
        }
  }}]}

  service.spreadsheets.batchUpdate(
    {spreadsheetId: sheetID, resource:batchUpdateRequest}
  ).then( (results) => {
    console.log(results.data)
    res.send()
  } ).catch(err => {throw err})

})

app.use( (req, res) => {
    res.status(404).render('error')
} )

// reloadData(600000)