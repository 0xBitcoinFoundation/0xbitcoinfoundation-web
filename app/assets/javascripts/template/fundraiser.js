
export default class Fundraiser {


constructor(Eth)
{
  this.Eth = Eth;
}

  init()
{
  console.log('Loading fundraiser')
//  this.loadFundraiserData();

}

//move me

   getEthBalance(address){
    return new this.Eth(new this.Eth.HttpProvider("https://mainnet.infura.io/v3/e13ed05a1d0840f487efde90f47c46c8")).getBalance(address, "latest");
}

   moveProgressBar(percent, element_id) {
    let elem = document.getElementById(element_id);
    let width = 0;
    let interval_id = setInterval(function(){
        if (width >= percent) {
            clearInterval(interval_id);
        } else {
            width += Math.max(0.001, (percent-width)/5)
            elem.style.width = width + '%';
            elem.innerHTML = Math.round(width) * 1 + '%';
        }
    }, 33.333);

}

//   loadFundraiserData() {
//    let element_id = "fundraiser-progress-bar";
//    let address = "0xc22E34923F14f1663DdAB4956F92784DD4FE360a";
//    let name = "CCN Donation Fund";
//    let goal_balance_eth = 9;
//    this.getEthBalance(address).then((result) => {
//        return 100 * Number(this.Eth.fromWei(result, "ether")) / goal_balance_eth
//    }).then((result) => {
//        this.moveProgressBar(result, element_id)
//    }).catch((error) => {
//        console.log("err", error)
//    });
//}



}
