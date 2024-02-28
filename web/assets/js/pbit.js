function stringUnquote(quotedString){
    return quotedString.replace(/^"(.*)"$/, '$1');
}

/**
 * Get the query represent in Query =  , m expression
 * @param {*} expression 
 * @returns 
 */
function getSqlQuery(expression){

    let startIndex = expression.indexOf('"') + 1;
    
    let endIndex = expression.lastIndexOf('"');

    return expression.substring(startIndex, endIndex);
}

function cleanSqlQuery(query){
    //replace a new feed character with a white space
    query = query.replace(/#\(lf\)/g, " ");

    //replace a duplicate double quote to a single double quote
    query = query.replace(/"{2,}/g, '"');

    query = query.replace(/#\(tab\)/g, " ");

    return query;
}

/**
 * Change 
 * Input : this is a ""column""
 * Output : this is a column
 * @param {*} str 
 * @returns 
 */
function removeDuplicateDoubleQuote(str){
    return str.replace(/"{2,}/g, '');
}


/**
 * Get the json object of DataModelSchema in pbit file
 * Require jszip.min.js version 3.10.1
 * @param {File} pbitFile 
 * @returns Promise<JsonObject>
 */
function getDataModelSchema(pbitFile){

    return new Promise((resolve,reject)=>{

        const zip = new JSZip();

        zip.loadAsync(pbitFile)
        .then(zip=>{
            const schemaFile = zip.file("DataModelSchema");

            if(schemaFile){
                return schemaFile.async("uint8array");
            }else{
                reject(new Error("DataModelSchema not found in the zip file"));
            }
        })
        .then(schemaContext=>{

            const decoder = new TextDecoder("utf-16");

            const jsonString = decoder.decode(schemaContext);

            const json = JSON.parse(jsonString);

            resolve(json);

        }).catch(error=>{
            
            reject(error);
        });
        
    });
}


/**
 * Array of json object which have the property of 
 * name = dataset name,
 * host = sql server host
 * database = sql server database
 * query = query used to get information from sql server
 * @param {File} pbitFile 
 * @returns Promise<Array<JsonObject>>
 */
function getDataset(pbitFile){
    return new Promise((resolve,reject)=>{

        getDataModelSchema(pbitFile)
        .then(json=>{

            const tables = json.model.tables;
            
            const expressions = tables.filter((table)=>{
                /*
                table created by powerbi internally have the isHidden key
                and isHidden value to be true
                */
                return table.hasOwnProperty("partitions") 
                && !table.hasOwnProperty("isHidden");
            })
            .flatMap((table)=>{
                return table.partitions;
            })
            .filter((partition)=>{
                return partition.hasOwnProperty("name") 
                && partition.hasOwnProperty("mode")
                && partition.hasOwnProperty("source") 
                && partition.mode=="import";
            })
            .map((partition)=>{
                return {
                    "name":partition.name,
                    "source":partition.source
                };
            })
            .filter((dataset)=>{
                return dataset.source.hasOwnProperty("type")
                && dataset.source.type=="m"
                && dataset.source.hasOwnProperty("expression");
            })                
            .map((dataset)=>{
                return {
                    "name":dataset.name,
                    //second line of source in define what kind of dataset it is
                    "expression":dataset.source.expression[1]
                };
            }).map((dataset)=>{

                const sourceExpression = dataset.expression.split("=")[1]

                const sourceType = sourceExpression.split("(")[0]

                return {
                    "name":dataset.name,
                    "expression":dataset.expression,
                    "sourceType":sourceType.trim()
                }
            })
            .filter((dataset)=>{
                //get only the sql dataset
                return dataset.sourceType=="Sql.Database"
            })
            .map((dataset)=>{
                
                const blocks = dataset.expression.split(",");

                const host = stringUnquote(blocks[0].split("(")[1].trim());

                const database = stringUnquote(blocks[1].trim());

                const queryExpression = blocks.slice(2).join(",");

                const query = cleanSqlQuery(getSqlQuery(queryExpression));


                return {
                    "name":dataset.name,
                    "host":host,
                    "database":database,
                    "orgQuery":queryExpression,
                    "query": query
                };

            });


            resolve(expressions);
            
        }).catch(error=>{
            reject(error);
        })
    });

}