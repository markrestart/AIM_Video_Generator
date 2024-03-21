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
  //Capitalise the first letter of each character name
  characterNames = characterNames.map((name) => name.charAt(0).toUpperCase() + name.slice(1));

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
  const background = new FFImage({ path: path.join(__dirname, "assets/phone.png"), x: 300, y: 500 });
  scene.addChild(background);
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
  const heightLimit = 600;
  messageGap = 40;

  const xValue = 80;
  const topYValue = 200;
  const underYValue = 1200;
  const aboveYValue = -10000;

  chat.forEach((message) => {
    const enterTime = Math.abs((new Date(message.timestamp) - chatData.startTime) / 1000 / 60);
    const characterName = chatData.users.find((user) => user.username === message.userName).characterName;

    //Set up the message
    const text = new FFText({ text: `${message.content}`, x: xValue, y: underYValue });
    const characterText = new FFText({ text: `${characterName}:`, x: xValue, y: underYValue });
    text.setColor("#ffffff");
    text.setWrap(450);
    characterText.setColor("#cccfcd");
    text.setStyle({ fontSize: 24 });
    characterText.setStyle({ fontSize: 18 });
    const height = Math.ceil(message.content.length / 40) * 30 + messageGap;

    visableMessages.push({
      text: text,
      characterText: characterText,
      height: height,
      toBeDeleted: false,
      currentY: underYValue,
      content: message.content,
    });

    // Sum the heights of all the messages, and remove the oldest message if the total height exceeds the limit,
    // repeating until the total height is less than the limit, or there is only one message left
    let totalHeight = visableMessages.reduce((acc, message) => acc + message.height, 0);
    while (totalHeight > heightLimit && visableMessages.length > 1) {
      const oldMessage = visableMessages[0];
      oldMessage.toBeDeleted = true;
      totalHeight -= oldMessage.height;
    }

    //animate previous messages up
    visableMessages.forEach((message, index) => {
      const newY = message.toBeDeleted
        ? aboveYValue
        : topYValue +
          visableMessages
            .slice(0, index)
            .filter((message) => !message.toBeDeleted)
            .reduce((acc, message) => acc + message.height, 0);

      message.text.addAnimate({
        from: { x: xValue, y: message.currentY },
        to: { x: xValue, y: newY },
        time: 0,
        delay: enterTime * 3.875,
      });
      message.characterText.addAnimate({
        from: { x: xValue, y: message.currentY - 20 },
        to: { x: xValue, y: newY - 20 },
        time: 0,
        delay: enterTime * 3.875,
      });

      message.currentY = newY;
    });

    //Remove messages that are to be deleted
    visableMessages = visableMessages.filter((message) => !message.toBeDeleted);

    scene.addChild(text);
    scene.addChild(characterText);
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
  scene.setDuration(Math.abs(chatData.endTime - chatData.startTime) / 1000 / 60);
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
    const video = new FFVideo({ path: path.join(__dirname, `intermediate/${chat}.mp4`), x: i * 450 + 200, y: 540, width: 600, height: 1000, scale: 0.5 });
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

  chatData = await promptUserForCharacterNames(chatData);
  await generateVideo(chatData);
  console.log("Done");
}

main();
