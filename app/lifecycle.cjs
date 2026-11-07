async function prepareShutdown({busy,settings,dispose}){
 const requireIdle=()=>{if(busy())throw Error("Finish tool changes before restarting or quitting.");};
 requireIdle();await settings();requireIdle();await dispose();requireIdle();
}
module.exports={prepareShutdown};
