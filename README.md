


BASIC SETUP (needs Node8)

## installing Node

curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash

close and reopen terminal

nvm install 8

## booting the server

npm install   (# See Note A)

npm run dev

npm run webpack #(to build the website files)

# 0xBitcoin Web

The uncompiled code for 0xbitcoin.org, 0xbitcoin.github.io

### Commands

npm run dev
    Starts a local dev server to serve the website as a test

npm run webpack
     Compiles the website and outputs the static files in  /public


###  Note A: If you have problems, install these dependencies


npm install -g node-gyp

sudo apt-get install build-essential

You may need to do..
sudo apt-get install python2.7
npm config set python python2.7


# **NOTES**
- wallet.html still needs to be made to work with new theme
- template-2create-newpages.html is a template with random layouts and page setups you can use to create a new .html page if needed. (hide the "Areas" you don't want to use in the .html file)
- working on foundation.html
- working on media/links gallery/package
