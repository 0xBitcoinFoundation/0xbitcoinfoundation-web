/* hashrate graph generator

call showHashrateGraph(...) to apply graph to canvas with ID 'chart-hashrate'

NOTE: assumes mineable_token vue exists in the global scope
 */

const Chart = require('./chart.min');
const Eth = require('./ethjs');

/* color of the fonts used in chart labels */
Chart.defaults.global.defaultFontColor = '#0059a2';
Chart.defaults.global.hover.mode = 'nearest';
/* color of thehashrate line */
let chart_line_border_color = '#ff7f00';
/* color of the fill under hashrate line */
let chart_line_background_color = '#e0ffd4';
/* color of the chart gridlines */
let gridline_color = '#cce3fa';
/* color of the first chart gridline */
let background_color = '#ffffff';
/* color of the first chart gridline background */
let gridline_zero_color = '#08223b';
/* axis label options */
let y_axis_label_color = '#ff7f00';
let axis_label_font_size = 14;


/* intrinsic values */
const _ZERO_BN = new Eth.BN(0, 10);

/* sleep for given number of milliseconds. note: must be called with 'await' */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* convert number to a readable hashrate string ("244.32 Gh/s", "3.05 Th/s") */
function toReadableHashrate(hashrate, should_add_b_tags) {
  units = ['H/s', 'Kh/s', 'Mh/s', 'Gh/s', 'Th/s', 'Ph/s'];
  var final_unit = 'Eh/s';
  for(idx in units) {
    var unit = units[idx];
    if(hashrate < 1000) {
      final_unit = unit;
      break;
    } else {
      hashrate /= 1000;
    }
  }
  var hashrate_string = hashrate.toFixed(2);

  if(hashrate_string.endsWith('.00')) {
    hashrate_string = hashrate.toFixed(0);
  }

  if(should_add_b_tags) {
    hashrate_string = '<b>' + hashrate_string + '</b>';
  }
  return hashrate_string + ' ' + final_unit;
}

/* convert to readable.. but also hide many values */
function toReadableHashrateForLogScale(hashrate, should_add_b_tags) {
  units = ['H/s', 'Kh/s', 'Mh/s', 'Gh/s', 'Th/s', 'Ph/s'];
  var final_unit = 'Eh/s';
  if (hashrate == 0) {
    return '';
  }
  for(idx in units) {
    var unit = units[idx];
    if(hashrate < 1000) {
      final_unit = unit;
      break;
    } else {
      hashrate /= 1000;
    }
  }
  for (var exp=0; exp < 3; exp++) {
    if(0
       || hashrate == 1*10**exp
       || hashrate == 2*10**exp
       || hashrate == 3*10**exp
       || hashrate == 4*10**exp
       || hashrate == 5*10**exp
       || hashrate == 6*10**exp
       || hashrate == 7*10**exp
       || hashrate == 8*10**exp
       || hashrate == 9*10**exp) {
      return '';
    }
  }
  var hashrate_string = hashrate.toFixed(0);
  if(should_add_b_tags) {
    hashrate_string = '<b>' + hashrate_string + '</b>';
  }
  /* TODO: the space  at the end here is used to add padding between the axis
           labels and the gridlines of the chart. This would be better solved
           by using some king of chart.js setting */
  return hashrate_string + ' ' + final_unit + ' ';
}

/*
    Function generator. Takes the most recent eth block and returns a function
    which can be used to convert eth blocks to date strings.

    Use it (and current time) to guess timestamp of a given past eth block.
    Value is returned as a formatted date/time string.
 */
function createEthDateFunction(current_eth_block) {
  return (eth_block) => {
    let SECONDS_PER_ETH_BLOCK = 15;

    var options = { year: undefined, month: 'short', day: 'numeric' };
    let date = new Date(Date.now() - ((current_eth_block - eth_block)*SECONDS_PER_ETH_BLOCK*1000));
    return date.toLocaleDateString(undefined, options);
  }
}

/*Helper class for loading historical data from ethereum contract variables.
  Initialize with an ethjs object, target contract address, and an integer
  index that points to your desired variable in in the contract's storage area
  obj.addValueAtEthBlock(<block number>) starts a request to fetch
  and cache the value of your variable at that time. Note if you pass a
  non-integer block number it will be rounded.

  obj.areAllValuesLoaded() will return true once all fetches are complete
  obj.getValues returns all requested data
 */
class contractValueOverTime {
  constructor(eth, contract_address, storage_index) {
    /* how long to wait between sequential requests */
    this.WAIT_DELAY_FIXED_MS = 60;
    /* how long to wait before retrying after a timeout */
    this.WAIT_DELAY_ON_TIMEOUT_MS = 1000;

    this.eth = eth;
    this.contract_address = contract_address;
    this.storage_index = storage_index;
    this.sorted = false;
    this.states = [];
    /* since values are added asynchronously, we store the length we
    expect state to be once all values are pushed */
    this.expected_state_length = 0;
  }
  get getValues() {
    return this.states;
  }
  printValuesToLog() {
    this.states.forEach((value) => {
      console.log('block #', value[0], 'ts', value[2], 'value[1]:', (value[1]).toString(10));
    });
  }
  /* fetch query_count states between start_block_num and end_block_num */
  async addValuesInRange(start_block_num, end_block_num, query_count) {
    var stepsize = (end_block_num-start_block_num) / query_count;

    for (var count = 0; count < query_count; count += 1) {
      let block_num = end_block_num - (stepsize*count);
      this.addValueAtEthBlock(block_num);
      await sleep(this.WAIT_DELAY_FIXED_MS);
    }
  }

  _getSaveStateFunction(block_states, eth_block_num, retry_delay) {
    let cv_obj = this;

    if(retry_delay == null) {
      retry_delay = cv_obj.WAIT_DELAY_ON_TIMEOUT_MS;
    }

    return async function (value) {
      /* for some reason, this is how infura 'fails' to fetch a value */
      /* TODO: only re-try a certain number of times */
      if (value == '0x' || value == null) {
        await sleep(retry_delay);
        /* 2nd param indicidates is_retry, 3rd is wait time (for exponential backoff) */
        cv_obj.addValueAtEthBlock(eth_block_num, true, retry_delay*2);
        return;
      } else {
        /* TODO: probably a way to convert w/o going through hex_str */
        var hex_str = value.substr(2, 64);
        var value_bn = new Eth.BN(hex_str, 16)

        cv_obj.sorted = false;
        /* [block num, value @ block num, timestamp of block num] */
        var len = block_states.push([eth_block_num, value_bn, '']);

        /* TODO: uncomment this to use timestamps embedded in block */
        // eth.getBlockByNumber(eth_block_num, true).then(setValue((value)=>{block_states[len-1][2]=value.timestamp.toString(10)}))
      }
    }
  }
  addValueAtEthBlock(eth_block_num, is_retry, retry_delay) {
    /* read value from contract @ specific block num, save to this.states
       detail: load eth provider with a request to load value from
       block @ num. Callback is anonymous function which pushes the
       value onto this.states */
    let cv_obj = this;
    if(is_retry == null) {
      this.expected_state_length += 1;
    }
    if(retry_delay == null) {
      retry_delay = this.WAIT_DELAY_ON_TIMEOUT_MS;
    }

    /* make sure we only request integer blocks */
    eth_block_num = Math.round(eth_block_num)

    this.eth.getStorageAt(this.contract_address,
                          new Eth.BN(this.storage_index, 10),
                          eth_block_num.toString(10))
    .then(
      this._getSaveStateFunction(this.states, eth_block_num, retry_delay)
    ).catch(async (error) => {
      if(error.message && error.message.substr(error.message.length-4) == 'null') {
        console.log('got null from infura, retrying...');
      } else {
        console.log('error reading block storage:', error);
      }
      await sleep(retry_delay);
      /* 2nd param indicidates is_retry, 3rd is wait time (for exponential backoff) */
      cv_obj.addValueAtEthBlock(eth_block_num, true, retry_delay*2);
      return;
    });

  }
  areAllValuesLoaded() {
    return this.expected_state_length == this.states.length;
  }
  async waitUntilLoaded() {
    while (!this.areAllValuesLoaded()) {
      await sleep(500);
    }
  }
  // onAllValuesLoaded(callback) {
  //   this.on_all_values_loaded_callback = callback;
  // }
  sortValues() {
    this.states.sort((a, b) => {
      //console.log('a', a[0], 'b', b[0]);
      return a[0] - b[0];
    });
    this.sorted = true;
  }
  /* iterate through already loaded values. Wherever a state change is
  seen, queue another value load from the blockchain halfway between
  state A and state B. Goal is to get closer to the actual eth block
  number where the state transition occurs. */
  increaseTransitionResolution() {
    if(!this.sorted) {
      this.sortValues();
    }

    var last_block_number = this.states[0][0];
    var last_value = this.states[0][1];
    for(var i = 0; i < this.states.length; i++) {
      var block_number = this.states[i][0];
      var value = this.states[i][1];
      if(last_value.cmp(value) != 0) {
        this.addValueAtEthBlock(((last_block_number + block_number)/2));
      }
      last_value = value;
      last_block_number = block_number;
    }
  }
  /* iterate through already loaded values. If 3 or more repeating
  values are detected, remove all middle values so only the first and
  last state with that value remain  */
  deduplicate() {
    if(!this.sorted) {
      this.sortValues();
    }
    /* we actually go backwards so we don't screw up array indexing
    as we remove values along the way */
    for(var i = this.states.length-1; i >= 2 ; i--) {
      var v1 = this.states[i][1];
      var v2 = this.states[i-1][1];
      var v3 = this.states[i-2][1];

      if (v1.cmp(v2) == 0
          && v2.cmp(v3) == 0) {
        /* remove one item at location i-1 (middle value) */
        this.states.splice(i-1, 1);
      }
    }
  }
  /* iterate through already loaded values. If 2 or more repeating values are
     detected, remove all but the first block where that value is seen. */
  removeExtraValuesForStepChart(allow_last_value) {
    if(allow_last_value == undefined) {
      allow_last_value = true;
    }
    if(allow_last_value) {
      var start_index = this.states.length-2;
    } else {
      var start_index = this.states.length-1;
    }
    if(!this.sorted) {
      this.sortValues();
    }
    /* we actually go backwards so we don't screw up array indexing
    as we remove values along the way */
    for(var i = start_index; i >= 1 ; i--) {
      var v1 = this.states[i][1];
      var v2 = this.states[i-1][1];

      if (v1.cmp(v2) == 0) {
        /* remove one item at location i (first value) */
        this.states.splice(i, 1);
        this.expected_state_length -= 1;
      }
    }
  }
  /* For some reason occasionally the last value loaded is zero. Running this
     function will remove it, if it is there */
  deleteLastPointIfZero() {
    if (this.states.length == 0) {
      return;
    }
    if (this.states[this.states.length-1][1].eq(new Eth.BN(0))) {
      console.log('warning: got a zero value at end of dataset');
      console.log('before - len', this.states.length);
      console.log(this.states);

      /* remove one item at location length-1 (last value) */
      this.states.splice(this.states.length-1, 1);

      console.log('after - len', this.states.length);
      console.log(this.states);
    }
  }
}

function generateHashrateGraph(eth, max_target_bn, ideal_block_time_seconds, target_cv_obj, era_cv_obj, ethBlockNumberToDateStr) {
  var target_values = target_cv_obj.getValues;
  var era_values = era_cv_obj.getValues;

  function convertValuesToChartData(values, value_mod_function) {
    var chart_data = []
    for (var i = 0; i < values.length; i++) {
      /* TODO: remove this if we expect some values to be zero */
      if(values[i][1].eq(_ZERO_BN)) {
        continue;
      }
      if(value_mod_function == undefined) {
        value_mod_function = function(v){return v};
      }
      chart_data.push({
        x: values[i][0],
        y: value_mod_function(values[i][1]),
      })
    }
    return chart_data;
  }

  function getErasPerBlockFromEraData(era_values) {
    var chart_data = []
    for (var step = 1; step < era_values.length; step++) {

      var eth_blocks_passed = era_values[step][0] - era_values[step-1][0];
      var eras_passed = era_values[step][1] - era_values[step-1][1];

      if (eth_blocks_passed == 0) {
        continue;
      }

      var eras_per_eth_block = eras_passed / eth_blocks_passed;

      chart_data.push({
        x: era_values[step][0],
        y: eras_per_eth_block,
      })
    }
    return chart_data;
  }

  function getHashrateDataFromDifficultyAndErasPerBlockData(max_target_bn, ideal_block_time_seconds, difficulty_data, eras_per_block_data) {
    var expected_eras_per_block = 1/40; /* should be 40 times slower than ethereum (with 15-second eth blocks) */
    var difficulty_data_index = 0;
    var difficulty_change_block_num = 0;
    var chart_data = []
    for (var step = 0; step < eras_per_block_data.length; step++) {
      var current_eth_block = eras_per_block_data[step].x;
      var current_eras_per_block = eras_per_block_data[step].y;

      while(difficulty_data_index < difficulty_data.length - 1
            && difficulty_data[difficulty_data_index+1].x < current_eth_block) {
        difficulty_change_block_num = difficulty_data[difficulty_data_index+1].x;
        difficulty_data_index += 1;
      }

      var difficulty = difficulty_data[difficulty_data_index].y.toNumber();

      /* if difficulty change occurs within this step window */
      if (step != 0
          && difficulty_data_index != 0
          && eras_per_block_data[step].x > difficulty_change_block_num
          && eras_per_block_data[step-1].x < difficulty_change_block_num) {

        /* make a new half-way difficulty that takes the duration of each
           seperate difficulty into accout  */

        var step_size_in_eth_blocks = eras_per_block_data[step].x - eras_per_block_data[step-1].x;
        var diff1_duration = eras_per_block_data[step].x - difficulty_change_block_num;
        var diff2_duration = difficulty_change_block_num - eras_per_block_data[step-1].x;

        var current_difficulty = difficulty_data[difficulty_data_index].y.toNumber();
        /* NOTE: since the data is stored kind-of oddly (two values per
           difficulty: both the first and last known block at that value), we
           index difficulty_data as step-1 instead of step-2, skipping a
           value. */
        var last_difficulty = difficulty_data[difficulty_data_index-1].y.toNumber();

        difficulty = (current_difficulty * (diff1_duration/step_size_in_eth_blocks))
                     + (last_difficulty * (diff2_duration/step_size_in_eth_blocks));
      }

      var unadjusted_network_hashrate = difficulty * 2**22 / ideal_block_time_seconds;
      var network_hashrate = unadjusted_network_hashrate * (current_eras_per_block/expected_eras_per_block);

      chart_data.push({
        x: current_eth_block,
        y: network_hashrate,
      })
    }
    return chart_data;
  }

  var difficulty_data = convertValuesToChartData(target_values,
                                                 (x)=>{return max_target_bn.div(x)});
  var era_data = convertValuesToChartData(era_values);
  // var total_supply_data = convertValuesToChartData(tokens_minted_values,
  //                                                  (x)=>{return x / 10**8});
  var eras_per_block_data = getErasPerBlockFromEraData(era_values);
  //console.log('era data', eras_per_block_data);

  var hashrate_data = getHashrateDataFromDifficultyAndErasPerBlockData(max_target_bn, ideal_block_time_seconds, difficulty_data, eras_per_block_data);

  /* hashrate and difficulty chart */
  var hr_diff_chart = new Chart.Scatter(document.getElementById('chart-hashrate').getContext('2d'), {
    type: 'line',

    data: {
        datasets: [{
            label: "Current Estimated Hashrate",
            showLine: true,
            backgroundColor: chart_line_background_color,
            borderColor: chart_line_border_color,
            data: hashrate_data,
            fill: true,
            yAxisID: 'first-y-axis',
        }]
    },

    options: {
      legend: {
        display: true,
      },
      tooltips: {
        intersect: false,
        callbacks: {
          label: function(tooltipItem, data) {
            var label = ''

            /* Note: might have issues here if you dont set dataset label */
            label = ethBlockNumberToDateStr(tooltipItem.xLabel)
                    + ': '
                    + toReadableHashrate(tooltipItem.yLabel);
            return label;
          }
        }
      },
      scales: {
        xAxes: [{
          gridLines: {
            color: gridline_color,
            zeroLineColor: gridline_zero_color,
            tickMarkLength: 1,
            //drawOnChartArea: false,
          },
          ticks: {
            fontSize: axis_label_font_size,
            callback: function(value, index, values) {
              return ethBlockNumberToDateStr(value);
            },
            stepSize: 24*((24*60*60)/15),  // 20 days
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            maxTicksLimit: 2,
            min: hashrate_data[0].x,
            max: hashrate_data[hashrate_data.length-1].x,
          }
        }],
        yAxes: [{
          id: 'first-y-axis',
          position: 'left',
          type: 'linear',
          //type: 'logarithmic',
          gridLines: {
            color: gridline_color,
            zeroLineColor: gridline_zero_color,
            tickMarkLength: 0,
            //drawOnChartArea: false,
          },
          ticks: {
            fontSize: axis_label_font_size,
            // Include a dollar sign in the ticks
            callback: function(value, index, values) {
              return toReadableHashrateForLogScale(value);
            },
            min: 0,
          }
        }]
      }
    },
  });
}


async function showHashrateGraph(eth, contract_address, max_target_string, ideal_eth_blocks_per_reward, current_eth_block, start_eth_block, end_eth_block, num_search_points){
  let SECONDS_PER_ETH_BLOCK = 15; // TODO: save eth block time constant somewhere
  let max_target_bn = new Eth.BN(max_target_string, 10);
  let ideal_block_time_seconds = ideal_eth_blocks_per_reward * SECONDS_PER_ETH_BLOCK;

  // 'lastDifficultyPeriodStarted' is at location 6
  // NOTE: it is important to make sure the step size is small enough to
  //       capture all difficulty changes. For 0xBTC once/day is more than
  //       enough.
  var last_diff_start_blocks = new contractValueOverTime(eth, contract_address, '6', 'diffStartBlocks');
  // 'reward era' is at location 7
  var era_values = new contractValueOverTime(eth, contract_address, '7', 'eraValues');
  // 'mining target' is at location 11
  var mining_target_values = new contractValueOverTime(eth, contract_address, '11', 'miningTargets');

  last_diff_start_blocks.addValuesInRange(start_eth_block, end_eth_block, num_search_points);
  era_values.addValuesInRange(start_eth_block, end_eth_block, num_search_points);

  console.log('graph waiting 1...');
  await last_diff_start_blocks.waitUntilLoaded();

  // sort and archive before removing duplicates
  last_diff_start_blocks.sortValues();

  /* this operation removes removes duplicate values keeping only the first */
  last_diff_start_blocks.removeExtraValuesForStepChart();

  // Load 'mining target' at each eth block that indicated by the set of
  // latestDifficultyPeriodStarted values
  let diff_start_block_values = last_diff_start_blocks.getValues;
  for (var i in diff_start_block_values) {
    let block_num = diff_start_block_values[i][1].toString(10);
    mining_target_values.addValueAtEthBlock(block_num);
  }
  mining_target_values.addValueAtEthBlock(end_eth_block);

  console.log('graph waiting 2...');
  await mining_target_values.waitUntilLoaded();
  await era_values.waitUntilLoaded();

  mining_target_values.sortValues();
  era_values.sortValues();

  // TODO: remove this when we are sure it is fixed
  era_values.deleteLastPointIfZero();

  let ethBlockNumberToDateStr = createEthDateFunction(current_eth_block);

  generateHashrateGraph(eth, max_target_bn, ideal_block_time_seconds, mining_target_values, era_values, ethBlockNumberToDateStr);
}

module.exports.showHashrateGraph = showHashrateGraph;
