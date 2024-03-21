# AIM Video Generator

Welcome to the AIM Video Generator project!

## Description

The AIM Video Generator is a tool that allows you to generate videos based on a chat transcript form a game of Alice is Missing. This is meant to provide a nice way to re-experience a session, as well as see chat logs you missed out on between other players.

## Installation

To install the AIM Video Generator, follow these steps:

1. Clone the repository: `git clone https://github.com/your-username/AIM_Video_Generator.git`
2. Install the required dependencies: `npm install`

## Usage

To use the AIM Video Generator, follow these steps:

1. Open the project directory: `cd AIM_Video_Generator`
2. Add chat files to the `chats` folder
   - Chat files can be pulled using [discrub](https://chromewebstore.google.com/detail/discrub/plhdclenpaecffbcefjmpkkbdpkmhhbj)
   - Chat logs are expected to be in the format of the following [discord template](https://discord.com/template/T3DSB5HTKVmf). If another setup is used, you may need to adjust your data or the program.
3. Add any media files to the `media` folder.
4. Add or replace any assets in the `assets` folder.
5. Run the generator: `node index.js`

## Info Files

Please note that additional instructions can be found in the `info.txt` files located throughout the project.

The `info.txt` files can be found at the following locations relative to the root folder:

- `assets/`
- `media/`
- `chats/`

## Contributing

We welcome contributions from the community! If you'd like to contribute to the AIM Video Generator project, please follow these guidelines:

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Make your changes and commit them: `git commit -m "Add your changes"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a pull request

## License

This project is licensed under the [MIT License](LICENSE).

## Roadmap

1. Extraction
   - Pulling the chat data is currently done through an external application. Eventually, this should be possible to do directly in the app.
2. Video generation
   - This project currently relies on the FFCreator package to generate video. While it has worked to get the project started, it has a number of issues that may hinder further development. I am looking for a replacement, or may possibly create one myself.
3. Media
   - Media is not currently displayed in the chats. This is a planned feature.
4. Timing
   - The videos are currently being rendered at 60X speed for ease of testing. This will be changed soon. If you happen to be using the project before this is fixed, removing every instance of `/ 60` in the project should do it.
5. Display
   - The full combination video currently only really displays four chats well. This is sutiable for a 3 player game, but not 4 or 5. The plan is to have the video switch off which conversations are being displayed based on activity.
6. Transparency
   - The indevidual chat videos currently render with a black background. This is unavoidable with the current video generation method, because the current library requires exporting the chats to an mp4 before reimporting them to merge as a new render. Fixing this would be a priority if a new video generation library is created.

Happy video generating!
