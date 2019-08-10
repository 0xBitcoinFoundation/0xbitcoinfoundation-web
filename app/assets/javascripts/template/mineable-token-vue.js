const hashrateGraph = require("./hashrate-graph");
const holdersGraph = require("./holders-graph");
const tokenABI = require("./abi");
const Eth = require('./ethjs');
const $ = require('jquery');

import Vue from 'vue'

function to_readable_thousands(number, unit_type, decimal_count) {
  let units = []
  if (unit_type === "long") {
    units = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion', ' sextillion', ' septillion', ' octillion', ' nonillion'];
  } else if (unit_type === "short") {
    units = ['', 'k', 'm', 'b', 't', 'p', 's'];
  } else if (unit_type === "hashrate") {
    units = ['H/s', ' Kh/s', ' Mh/s', ' Gh/s', ' Th/s', ' Ph/s', ' Eh/s', ' Zh/s', ' Yh/s'];
  } else if (unit_type === "short_hashrate") {
    units = ['H', ' Kh', ' Mh', ' Gh', ' Th', ' Ph', ' Eh', ' Zh', ' Yh'];
  } else {
    console.log('bad unit type');
    fail;
  }
  for (var i in units) {
    if (number < 1000) {
      return number.toFixed(decimal_count) + units[i];
    }
    number /= 1000;
  }
  return (number*1000).toFixed(decimal_count) + units[units.length-1];
}


var mineable_token = new Vue({
  el: '#aboutUs',
  data: {
    address: null,
    _eth: null,
    _token: null,
    /* ethereum state */
    current_eth_block: 0,
    /* contract state */
    _recent_events: [],
    mining_target: '0',
    difficulty: 0,
    latest_difficulty_started: 0,
    tokens_minted: 0,
    max_supply_for_era: 0,
    last_reward_eth_block_number: 0,
    reward_era: 0,
    mining_reward: 0,
    epoch_count: 0,
    total_supply: 0,
    previous_latest_difficulty_started: 0,
    previous_mining_target: '0',
    /* pulled from ethplorer */
    contract_operations: 0,
    /* constants for 0xbitcoin, should really be pulled from contract */
    blocks_per_readjustment: null,
    decimals: null,
    max_target: null,
    ideal_eth_blocks_per_reward: null,
  },
  mounted: function(){
    console.log('mounted');
    this.updateContractStats("0xB6eD7644C69416d67B522e20bC294A9a9B405B31");
  },
  computed: {
    calculatedHashrate: function () {
      let SECONDS_PER_ETH_BLOCK = 15;

      let eth_blocks_since_readjustment = this.current_eth_block - this.latest_difficulty_started;
      let rewards_since_readjustment = this.epoch_count % this.blocks_per_readjustment;
      let seconds_since_readjustment = eth_blocks_since_readjustment * SECONDS_PER_ETH_BLOCK;
      let seconds_per_reward = seconds_since_readjustment / rewards_since_readjustment;

      /* TODO: calculate this equation from max_target (https://en.bitcoin.it/wiki/Difficulty) */
      return this.difficulty * 2**22 / seconds_per_reward;
    },
    readableHashrate: function () {
      return to_readable_thousands(this.calculatedHashrate, "hashrate", 1);
    },
    readableTokensMinted: function () {
      return Math.round(this.tokens_minted).toLocaleString();
    },
    readableTotalSupply: function () {
      return Math.round(this.total_supply).toLocaleString();
    },
    readableDifficulty: function () {
      return to_readable_thousands(this.difficulty, "long", 1);
    },
    readableContractOperations: function () {
      if (this.contract_operations == 0) {
        return "--";
      } else {
        return this.contract_operations.toLocaleString();
      }
    },
  },
  methods: {
    updateHashrateGraph: function () {
      let SECONDS_PER_ETH_BLOCK = 14;
      let GRAPH_HISTORY_DAYS = 1;
      let GRAPH_NUM_POINTS = 24;
      this._eth.blockNumber().then((result) => {
        let current_eth_block = parseInt(result.toString(10));
        let earliest_eth_block = current_eth_block - (GRAPH_HISTORY_DAYS * 24 * 3600 / SECONDS_PER_ETH_BLOCK);
        hashrateGraph.showHashrateGraph(this._eth,
                                        this.address,
                                        this.max_target,
                                        this.ideal_eth_blocks_per_reward,
                                        this.current_eth_block,
                                        earliest_eth_block,
                                        current_eth_block - 8,
                                        GRAPH_NUM_POINTS);
      });
    },
    updateContractStats: function (address) {
      this.address = address;
      if (this.address == "0xB6eD7644C69416d67B522e20bC294A9a9B405B31") {
        this.blocks_per_readjustment = 1024;
        this.decimals = 8;
        this.max_target = "27606985387162255149739023449108101809804435888681546220650096895197184";  // 2**234
        this.ideal_eth_blocks_per_reward = 60;
      } else {
        console.log('Unknown mineable token address');
        fail;
      }
      this._eth = new Eth(new Eth.HttpProvider("https://mainnet.infura.io/v3/e13ed05a1d0840f487efde90f47c46c8"));
      this._token = this._eth.contract(tokenABI.tokenABI).at(this.address);

      this._eth.blockNumber().then((result) => {this.current_eth_block = parseInt(result.toString(10))})

      this._token.getMiningTarget().then((result) => {this.mining_target = result[0].toString(10)})
      this._token.getMiningDifficulty().then((result) => {this.difficulty = parseInt(result[0].toString(10))})
      this._token.latestDifficultyPeriodStarted().then((result) => {
        this.latest_difficulty_started = parseInt(result[0].toString(10))
        // get previous value for latestDifficultyPeriodStarted
        // TODO: fix this, it does not work but would be very useful for hashrate estimation
        this._eth.getStorageAt(this.address,
                               new Eth.BN('6', 10),
                               this.latest_difficulty_started).then((result) => {
                                this.previous_latest_difficulty_started = parseInt(result[0].toString(10))
                               })
        // get previous value for miningTarget
        // TODO: fix this, it does not work but would be very useful for hashrate estimation
        this._eth.getStorageAt(this.address,
                               new Eth.BN('11', 10),
                               this.latest_difficulty_started).then((result) => {
                                this.previous_mining_target = parseInt(result[0].toString(10))
                               })
      })
      this._token.tokensMinted().then((result) => {this.tokens_minted = parseInt(result[0].toString(10)) / (10 ** this.decimals)})
      this._token.maxSupplyForEra().then((result) => {this.max_supply_for_era = parseInt(result[0].toString(10)) / (10 ** this.decimals)})
      this._token.lastRewardEthBlockNumber().then((result) => {
        this.last_reward_eth_block_number = parseInt(result[0].toString(10))

        /* get contract events in the last approx 48 hours worth of eth blocks */
        /* more info: https://github.com/ethjs/ethjs/blob/master/docs/user-guide.md#ethgetlogs */
        /* and https://ethereum.stackexchange.com/questions/12950/what-are-event-topics/12951#12951 */
        let recent_events = []
        let decimals = this.decimals
        this._eth.getLogs({
          fromBlock: this.last_reward_eth_block_number - (48 * 3600 / 15),
          toBlock: this.last_reward_eth_block_number,
          address: this.address,
          topics: [null, null],
        })
        .then((result) => {
          const mint_topic = "0xcf6fbb9dcea7d07263ab4f5c3a92f53af33dffc421d9d121e1c74b307e68189d";
          const transfer_topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          const approve_topic = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

          console.log("got filter results:", result.length, "transactions");

          result.forEach(function(transaction){
            let tx_hash = transaction['transactionHash'];
            let block_number = parseInt(transaction['blockNumber'].toString());
            let from_address;
            let to_address;
            let spender_address;
            let amount;
            //console.log('tx hash', tx_hash);
            switch(transaction['topics'][0].toString()){
              case mint_topic:
                //console.log('  is mint');
                from_address = '0x' + transaction['topics'][1].toString().substr(26, 41);
                //console.log('    tx_hash=', tx_hash);
                //console.log('      block=', block_number);
                //console.log('      miner=', from_address);
                recent_events.push(['mint', block_number, tx_hash, from_address])
                break;
              case transfer_topic:
                //console.log('  is transfer');
                from_address = '0x' + transaction['topics'][1].toString().substr(26, 41);
                to_address = '0x' + transaction['topics'][2].toString().substr(26, 41);
                amount = new Eth.BN(transaction['data'].substr(2,64), 16).toNumber() / (10 ** decimals);
                //console.log('    from_address=', from_address);
                //console.log('    to_address=', to_address);
                //console.log('    amount=', amount);
                recent_events.push(['transfer', block_number, tx_hash, from_address, to_address, amount])
                break;
              case approve_topic:
                //console.log('  is approve');
                from_address = '0x' + transaction['topics'][1].toString().substr(26, 41);
                spender_address = '0x' + transaction['topics'][2].toString().substr(26, 41);
                amount = new Eth.BN(transaction['data'].substr(2,64), 16).toNumber() / (10 ** decimals);
                //console.log('    from_address=', from_address);
                //console.log('    spender_address=', spender_address);
                //console.log('    amount=', amount);
                recent_events.push(['approve', block_number, tx_hash, from_address, spender_address, amount])
                break;
              default:
                console.log('  unknown topic', transaction['topics'][0].toString());
                console.log('    transaction', transaction);
                console.log('    tx topic 0', transaction['topics'][0].toString());
                console.log('    tx topic 1', transaction['topics'][1].toString());
                break;
            }
          });

        });
        this._recent_events = recent_events;
      });

      this._token.rewardEra().then((result) => {this.reward_era = parseInt(result[0].toString(10))})
      this._token.getMiningReward().then((result) => {this.mining_reward = parseInt(result[0].toString(10)) / (10 ** this.decimals)})
      this._token.epochCount().then((result) => {this.epoch_count = parseInt(result[0].toString(10))})
      this._token.totalSupply().then((result) => {this.total_supply = parseInt(result[0].toString(10)) / (10 ** this.decimals)})

      /* ethplorer 'total contract operation' count */
      $.getJSON('https://api.ethplorer.io/getAddressInfo/'+this.address+'?apiKey=freekey',
                (result) => {this.contract_operations = result["countTxs"]});
      this.updateHashrateGraph();
      this.callHoldersGraph();
    },
    callHoldersGraph: function() {
      this._token.tokensMinted().then((result) => {holdersGraph.showHoldersGraph(parseInt(result[0].toString(10)) / (10 ** this.decimals))});
    }
  }
})
