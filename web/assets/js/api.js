
/**
 * 
 * @param {string} sql 
 * @param {string} dialect 
 * @returns Promise<Array<string>> tables
 * 
 * Array<string> will be null if we cannot parse the sql
 */
function getSqlTables(sql,dialect="tsql"){

    const options = {
        "method":"POST",
        "headers":{
            "Content-Type":"application/json"
        },
        "body":JSON.stringify(
            {
                "sql":sql,
                "dialect":dialect
            }
        )
    };

    const url = "/tables";

    return fetch(url,options)
    .then(response=>{
        if(response.ok){
            return response.json();
        }
    });

}

function checkIsServiceOnline(){

    const url = "/ping";

    return fetch(url)
    .then(response=>{
        if(response.ok){
            return true;
        }
    });

}