

const Eth = require('./template/ethjs');


const $ = require('jquery');
const Vue = require('vue');
//const Popper = require('./template/popper');


const bootstrap = require('./template/bootstrap.min');
const main = require('./template/main');


import Fundraiser from './template/fundraiser'

const mineable_token = require('./template/mineable-token-vue.js');
//import TokenStats from './template/tokenStats'


let fundraiser = new Fundraiser(Eth);
//let tokenStats = new TokenStats();

$(document).ready(function() {
  console.log("DOMready");

  fundraiser.init()

//  tokenStats.init();

});
