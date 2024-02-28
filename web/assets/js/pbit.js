function stringUnquote(quotedString){
    return quotedString.replace(/^"(.*)"$/, '$1');
}

/**
 * Get the query represent in Query =  , m expression
 * @param {*} expression 
 * @returns sql string
 */
function getSqlQuery(expression){

    let startIndex = expression.indexOf('"') + 1;
    
    let endIndex = expression.lastIndexOf('"');

    return expression.substring(startIndex, endIndex);
}

/**
 * In Source{[Schema="foo",Item="bar"]}'
 * Return 
 * {
 *   "schema":"foo",
 *   "item":"bar"
 * }
 * @param {*} expression 
 * @returns 
 */
function extractValues(expression){

    // Match everything between the curly braces
    
       let match = expression.match(/\{([^}]*)\}/);

       if (match) {
           
           let parts = match[1].split(",");

           let result = {};

           let newParts = []
           newParts.push(parts[0].substring(1));
           newParts.push(parts[1].substring(0,parts[1].length-2));

            // Extract key-value pairs

           parts.forEach(part => {

                let [key, value] = part.split("=");

                key=key.replace("[","").trim().toLowerCase();

                value = value.replace(/"/g, "").replace("]","").trim();

                result[key] = value;

           });

           return result;
       }
       return null;
}

/**
 * Transform the direct table expression to sql query
 * @param {*} expression 
 * @returns sql query
 */
function getImportQuery(expression){

    let map = extractValues(expression);

    const query = `SELECT * FROM ${map.schema}.${map.item}`;

    return query;
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

                let tableImportExpression = null;

                if(dataset.source.expression.length>=2){
                    tableImportExpression = dataset.source.expression[2];
                }

                return {
                    "name":dataset.name,
                    //second line of source in define what kind of dataset it is
                    "expression":dataset.source.expression[1],
                    "tableImportExpression":tableImportExpression
                };
            }).map((dataset)=>{

                const sourceExpression = dataset.expression.split("=")[1]

                const sourceType = sourceExpression.split("(")[0]

                const functionParameterLength = dataset.expression.split("(")[1].split(")")[0].split(",").length-1;
                
                //to check whether the table is imported as direct import without any sql statement

                const isTableDirectImport = (functionParameterLength==1);

                return {
                    "name":dataset.name,
                    "expression":dataset.expression,
                    "sourceType":sourceType.trim(),
                    "isTableDirectImport":isTableDirectImport,
                    "tableImportExpression":dataset.tableImportExpression
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

                let queryExpression = "";

                let query = "";

                if(dataset.isTableDirectImport){

                    queryExpression = dataset.tableImportExpression;

                    query = getImportQuery(queryExpression);

                }
                else{

                    queryExpression = blocks.slice(2).join(",");

                    query = cleanSqlQuery(getSqlQuery(queryExpression));
                }


                return {
                    "name":dataset.name,
                    "host":host,
                    "database":database,
                    "orgQuery":queryExpression,
                    "query": query,
                    "isTableDirectImport":dataset.isTableDirectImport
                };

            });


            resolve(expressions);
            
        }).catch(error=>{
            reject(error);
        })
    });

}