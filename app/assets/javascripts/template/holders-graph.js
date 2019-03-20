const Chart = require('./chart.min');

function generateHoldersGraph(holders, minted) {

  var amount = [];
  var label_list = [];
  var colors = [];

  colors.push('#b9b9b9');
  colors.push('#2ab500');
  colors.push('#08457e');
  colors.push('#e1a95f');

  // Used to get the 'other' holders
  var sum = 0;

  for(var i = 0; i < holders.length; i++) {

    amount.push(holders[i][2]); // holders[i][2] returns 0xbtc balance
    label_list.push(`#${i+1} ${holders[i][0].substring(0,10)}... ${isExchange(holders[i][0])} (${((amount[i] * 100) / minted).toFixed(3)}%)`); // Pushes address label and a string, wallet or dex.
    // holders[i][0] returns wallet address holders
    // [i][1] returns string 'dex' or 'wallet'

    sum += holders[i][2];
    //Random color
    var randomColor = "#000000".replace(/0/g,function randomColor() {return (~~(Math.random()*16)).toString(16);});
    colors.push(randomColor);
  }

  // This pushes the 'Other Wallets Total'
  amount.unshift(Math.round(minted - sum));
  label_list.unshift(`Other Wallets Total (${((amount[0] * 100) / minted).toFixed(3)}% of Supply)`);

  var data = {
      datasets: [{
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: `0`,
        hoverBorderWidth: `5`,
        hoverBorderColor: colors,
        data: amount
      }],

      // These labels appear in the legend and in the tooltips when hovering different arcs
      labels: label_list
  };

  var myPieChart = new Chart(document.getElementById('pie-holders').getContext('2d'), {
    type: 'pie',
    data: data,
    options: {
         legend: {
            display: false
         }
    }
  });
}

async function getTokenHolders() {
  return new Promise((resolve, reject) => {
      $.getJSON('https://api.allorigins.win/get?url='
      + encodeURIComponent('https://bloxy.info/api/token/token_holders_list?token=0xb6ed7644c69416d67b522e20bc294a9a9b405b31&limit=500&key=ACCl2UPf2Pgqi&format=table')
      + '&callback=?', function(data) {
      resolve(JSON.parse(data.contents));
      });
    });
  }

async function getWallets() {
  return new Promise((resolve, reject) => {
    $.getJSON('https://api.ethplorer.io/getTokenInfo/0xB6eD7644C69416d67B522e20bC294A9a9B405B31?apiKey=freekey', function(data) {
    resolve(data);
      });
    });
  }

async function showHoldersGraph(tokensMinted) {

  // Holds top wallets data
  var tokenHolders = await getTokenHolders();

  // Used for total wallet count representation
  var wallets = await getWallets();
  $('.wallets').text('Total Holders: ' + wallets.holdersCount);

  generateHoldersGraph(tokenHolders, tokensMinted);
}

function isExchange(address) {

  // Add exchanges here
  var exchanges = [{
    address:'0xc91795a59f20027848bc785678b53875934792a1',
    name: 'Mercatox'
  },
  {
    address:'0x8d12a197cb00d4747a1fe03395095ce2a5cc6819',
    name: 'EtherDelta'
  },
  {
    address:'0x2a0c0dbecc7e4d658f48e01e3fa353f44050c208',
    name: 'IDEX'
  },
  {
    address:'0xe03c23519e18d64f144d2800e30e81b0065c48b5',
    name: 'Mercatox 2'
  },
  {
    address:'0x701564aa6e26816147d4fa211a0779f1b774bb9b',
    name: 'Uniswap 0xBTC'
  },
];

  for(var i = 0; i < exchanges.length; i++) {
    if(address == exchanges[i].address) {
      return exchanges[i].name;
    }
  }

  return 'Wallet';
}

module.exports.showHoldersGraph = showHoldersGraph;
