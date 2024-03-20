const fs = require("fs");
const colors = require("colors");
var path = require("path");
const readline = require("readline");
const { FFScene, FFText, FFImage, FFVideo, FFCreator } = require("ffcreator");

const chatsFolderPath = "./chats";

function loadChatData() {
  const chatData = {
    chats: {},
    users: [],
    characterNames: [],
    startTime: null,
    endTime: null,
  };
  const files = fs.readdirSync(chatsFolderPath);

  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const filePath = `${chatsFolderPath}/${file}`;
      const fileData = fs.readFileSync(filePath, "utf-8");
      const jsonData = JSON.parse(fileData);

      // Extract character names from the file name
      const characterNames = file.split("_").slice(0, -1);

      // Two characters chatting
      const key = characterNames[0] + "_" + characterNames[1];
      if (!chatData.chats[key]) {
        chatData.chats[key] = [];
      }
      chatData.chats[key].push(...jsonData);

      // Add character names to the list of character names
      if (characterNames[0] !== "group") {
        if (!chatData.characterNames.includes(characterNames[0])) {
          chatData.characterNames.push(characterNames[0]);
        }
        if (!chatData.characterNames.includes(characterNames[1])) {
          chatData.characterNames.push(characterNames[1]);
        }
      }
    }
  });

  // cleanup chatData and extract users
  Object.values(chatData.chats).forEach((chatArray) => {
    chatArray.forEach((message) => {
      //Remove Author, channel_id, tts, mention_everyone, mentions, pinned, type, flags, and components
      delete message.author;
      delete message.channel_id;
      delete message.tts;
      delete message.mention_everyone;
      delete message.mentions;
      delete message.pinned;
      delete message.type;
      delete message.flags;
      delete message.components;
      delete message.embeds;

      if (message.userName && !chatData.users.some((x) => x.username === message.userName)) {
        chatData.users.push({ username: message.userName, characterName: "" });
      }
    });

    // Sort the chatArray by timestamp
    chatArray.sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // if the earliest message is null or earlier than the current start time, update the start time
    if (chatData.startTime === null || new Date(chatArray[0].timestamp) < chatData.startTime) {
      chatData.startTime = new Date(chatArray[0].timestamp);
    }
    if (chatData.endTime === null || new Date(chatArray[chatArray.length - 1].timestamp) > chatData.endTime) {
      chatData.endTime = new Date(chatArray[chatArray.length - 1].timestamp);
    }
  });
  //log duration of chat
  console.log(`Chat duration: ${Math.abs(chatData.endTime - chatData.startTime) / 1000 / 60} minutes`);

  return chatData;
}

async function promptUserForCharacterNames(chatData) {
  var characterNames = chatData.characterNames;
  delete chatData.characterNames;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  return new Promise((resolve) => {
    const promptUser = async () => {
      for (let user of chatData.users) {
        while (user.characterName === "") {
          let characterName = await question(`Please enter the character name for user '${user.username}'(${characterNames.join(", ")}): `);
          if (characterNames.includes(characterName)) {
            console.log(`Matched username '${user.username}' with character name '${characterName}'`);
            user.characterName = characterName;
            //characterNames = characterNames.filter((name) => name !== characterName);
          } else {
            console.log(`Invalid character name '${characterName}'.`);
          }
        }
      }
      rl.close();
      resolve(chatData);
    };

    promptUser();
  });
}

function generateSingleConversationVideo(chatData, characterName1, characterName2) {
  // Create FFCreator instance
  const creator = new FFCreator({
    width: 600,
    height: 1000,
  });

  const duration = Math.abs(chatData.endTime - chatData.startTime) / 1000 / 60;

  // Setup scene
  const scene = new FFScene();
  scene.setDuration(duration); //TODO: set duration based on chat duration
  scene.setBgColor("#000000");
  creator.addChild(scene);

  // Add text
  const conversationTile = new FFText({ text: `${characterName1} ${characterName2}`, x: 100, y: 100 });
  conversationTile.setColor("#ffffff");
  scene.addChild(conversationTile);

  const chatKey = `${characterName1}_${characterName2}`;
  const chat = chatData.chats[chatKey];

  if (!chat) {
    console.error(`No chat data found for key '${chatKey}'`);
    return;
  }

  // Add text
  let visableMessages = [];
  const messageLimit = 5;

  const xValue = 100;
  const topYValue = 200;
  const underYValue = 1200;
  const aboveYValue = -200;
  const ySpreadValue = 200;

  chat.forEach((message) => {
    const enterTime = Math.abs((new Date(message.timestamp) - chatData.startTime) / 1000 / 60);

    //Set up the message
    const text = new FFText({ text: `${message.username}:${message.content}`, x: xValue, y: underYValue }); //TODO: use character name instead of username
    text.setSize(20);
    text.setWrap(400);
    text.setColor("#ff00ff");
    text.setStyle({ padding: 10, borderRadius: "10px" });
    const height = text.getWH()[1];

    //animate mesage in to scene
    text.addAnimate({
      from: { x: xValue, y: underYValue },
      to: { x: xValue, y: topYValue + ySpreadValue * visableMessages.length },
      time: 1,
      delay: enterTime,
    });

    //animate previous messages up
    visableMessages.forEach((message, index) => {
      message.addAnimate({
        from: { x: xValue, y: topYValue + ySpreadValue * index },
        to: { x: xValue, y: index === 0 ? aboveYValue : topYValue + ySpreadValue * (index - 1) },
        time: 1,
        delay: enterTime,
      });
    });

    //if there are more than 5 messages, remove the oldest message
    if (visableMessages.length >= messageLimit) {
      const oldMessage = visableMessages.shift();
    }

    visableMessages.push(text);

    scene.addChild(text);
  });

  // Create a video
  creator.output(path.join(__dirname, `intermediate/${characterName1}_${characterName2}.mp4`));
  creator.start();

  creator.on("progress", (e) => {
    console.log(colors.yellow(`${characterName1}_${characterName2} progress: ${(e.percent * 100) >> 0}%`));
  });

  return new Promise((resolve) => {
    creator.on("complete", (e) => {
      resolve(true);
    });

    creator.on("error", (e) => {
      resolve(false);
    });
  });
}

async function generateVideo(chatData) {
  // Create FFCreator instance
  const creator = new FFCreator({
    width: 1920,
    height: 1080,
  });

  // Add background
  const scene = new FFScene();
  scene.setDuration(6);
  const background = new FFImage({ path: path.join(__dirname, "assets/bg.png"), x: 960, y: 540 });
  scene.addChild(background);
  creator.addChild(scene);

  let videoPromises = [];
  // generate individual conversation videos
  const chatKeys = Object.keys(chatData.chats);

  chatKeys.forEach((key) => {
    const [characterName1, characterName2] = key.split("_");
    videoPromises.push(
      generateSingleConversationVideo(chatData, characterName1, characterName2).catch((error) =>
        console.error(`Error generating video for ${characterName1} and ${characterName2}:`, error)
      )
    );
  });

  // Wait for all videos to be generated
  await Promise.all(videoPromises).then((values) => {
    console.log(values);
  });

  // Add videos to the main video
  let i = 0;
  chatKeys.forEach((chat) => {
    const video = new FFVideo({ path: path.join(__dirname, `intermediate/${chat}.mp4`), x: i * 300 + 100, y: 540, width: 350, height: 800 });
    scene.addChild(video);
    i++;
  });

  // Create a video
  creator.output(path.join(__dirname, "output/video.mp4"));
  creator.start();
  creator.closeLog();

  creator.on("progress", (e) => {
    console.log(colors.yellow(`FFCreator progress: ${(e.percent * 100) >> 0}%`));
  });

  creator.on("complete", (e) => {
    console.log(colors.magenta(`FFCreatorLite completed: \n USEAGE: ${e.useage} \n PATH: ${e.output} `));
  });
}

// Entry point
async function main() {
  var chatData = loadChatData();

  //chatData = await promptUserForCharacterNames(chatData);
  await generateVideo(chatData);
  console.log("Done");
}

main();
