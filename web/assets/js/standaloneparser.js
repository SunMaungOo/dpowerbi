class Parser{

    constructor(){
        this.funcGetTableNames = null;
    }

    async init(){

        let pyodide = await loadPyodide();

        //install python library 

        await pyodide.loadPackage("micropip");

        const micropip = pyodide.pyimport("micropip");

        await micropip.install('sqlglot');

        const pythonCode = `

        from sqlglot import parse_one, exp, Dialects

        def get_cte_names(sql:str,dialect=Dialects.TSQL):
            sql_expression = parse_one(sql=sql,dialect=dialect)
            ctes = sql_expression.find_all(exp.CTE)
            return [cte.alias for cte in ctes]

        def clean_table_name(table_name:str):
            return table_name.replace('"',"").replace("[","").replace("]","")

        def get_full_table_name(table)->str:
            if table.db=="":
                return table.name
            return table.db+"."+table.name

        def get_table_names(sql:str,dialect=Dialects.TSQL)->set[str]:
            sql_expression = parse_one(sql=sql,dialect=dialect)
            cte_names = get_cte_names(sql=sql,dialect=dialect)
            tables = sql_expression.find_all(exp.Table)
            return set([clean_table_name(get_full_table_name(table)) for table in tables if clean_table_name(get_full_table_name(table)) not in cte_names])
        `;

        pyodide.runPython(pythonCode);

        //get reference to the python function

        this.funcGetTableNames = pyodide.globals.get("get_table_names");

    }


    /**
     * 
     * @param {string} sql 
     * @param {string} dialect 
     * @returns Promise<Array<string>> tables
     *  Array<string> will be null if we cannot parse the sql
     */
    getSqlTables(sql,dialect){

        return new Promise((resolve,reject)=>{

            let outputStr = "";

            try{
                outputStr = this.funcGetTableNames(sql,dialect).toString()
            }catch(error){
                resolve(null);
            }

            if(outputStr=="{}"){
                return null;
            }

            // "replace { } and ' "
            outputStr = outputStr.replace(/[{}']/g, '');

            resolve(Array.from(outputStr.split(",")));

        });

    }


}