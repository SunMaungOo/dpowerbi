
class App{

    /**
     * 
     * @param {*} sideBarId 
     * @param {*} textAreaId 
     * @param {*} exportId 
     * @param {*} statusId 
     * @param {CallableFunction} funcParser which accept sql and dialect and return Promise<Array<string>>
     * @param {CallableFunction} funcCheckStatus no input function and return Promise<boolean>
     */
    constructor(sideBarId,textAreaId,exportId,statusId,funcParser,funcCheckStatus){

        this.sideBar = new SideBarUI(sideBarId,this.callOnItemClicked.bind(this));

        this.textArea = document.getElementById(textAreaId);

        this.exportBtn = document.getElementById(exportId);

        this.state = null;

        this.exportBtn.addEventListener("click",(event)=>{

            this.exportUsedTable();

        });

        this.statusLbl = document.getElementById(statusId);

        this.funcParser = funcParser;

        this.funcCheckStatus = funcCheckStatus;

    }

    run(fileInputId){

        let fileInput = document.getElementById(fileInputId);

        if(!fileInput){
            return;
        }

        fileInput.addEventListener("change",(event)=>{

            const file = event.target.files[0];

            this.getTableDataset(file)
            .then(arrays=>{

                this.state = arrays;

                arrays.forEach(jsonObjs => {
                    
                    this.sideBar.addSideBarItem(jsonObjs);

                });

            });
   
        });


        if(this.funcCheckStatus){

            this.funcCheckStatus()
            .then((status)=>{
                if(status){
                    this.statusLbl.innerText = "Parser : Online";
                }
            })
            .catch(err=>{
                this.statusLbl.innerText = "Parser : Offline";
            });

        }
    }

    /**
    /**
     * Array of json object which have the property of 
     * {
     *   name:str,
     *   host:str,
     *   database:str,
     *   orgQuery:str,
     *   query:str,
     *   tables:Array<str>
     * }
     * @param {File} pbitFile 
     * @returns Promise<Array<JsonObject>>
    */
    getTableDataset(file) {

        return getDataset(file).then((sqlDataset) => {
    
            //get Array<Promise> which get the tables by calling the api
    
            const sqlTablePromises = sqlDataset.map((dataset) => {
    
                return this.funcParser(dataset.query, "tsql")
                    .then(tables => {
                        return {
                            "name": dataset.name,
                            "host": dataset.host,
                            "database": dataset.database,
                            "orgQuery": dataset.orgQuery,
                            "query": dataset.query,
                            //table which is used by the query.Maybe null on parsing error
                            "tables": tables
                        };
    
                    });
    
            });
    
            //return a single promise which got the Array<PromiseResult>
            return Promise.all(sqlTablePromises);
    
        });
    }

    callOnItemClicked(jsonObj){

        let tableStr = jsonObj.tables;

        let message = "";

        if(tableStr==null || tableStr=="null"){
            message = `Fail to get the used table\n\nExtracted SQL:\n=========\n\n ${jsonObj.query}\n\nOriginal Script:\n=========\n\n${jsonObj.orgquery}`;

        }else{

            message += "/*\n";
            message += "Used Table\n=========\n\n";

            message + "/*\n\n";

            tableStr.split(",").forEach(table=>{
                message += table;
                message += "\n";
            });

            message += "\n";
            message += "*/\n\n";
        
            message += `${jsonObj.query}`;


        }

        this.textArea.innerHTML = message;
    }

    exportUsedTable(){

        if(!this.state){
            alert("There is no data to export");
        }

        const usedTable = this.state.filter((jsonObjs)=>{
            return jsonObjs.tables!=null;
        }).flatMap((jsonObjs)=>{
            return jsonObjs.tables;
        });

        const uniqueUsedTable = [...new Set(usedTable)];

        const blob = new Blob([uniqueUsedTable.join("\n")],{
            "type":"text/csv;charset=utf-8;"
        });

        //create download link

        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = "used-table.csv";
        downloadLink.style.display="none";

        document.body.appendChild(downloadLink);

        downloadLink.click();

        document.body.removeChild(downloadLink);

    }

}


class SideBarUI{
    constructor(sideBarId,callOnItemClicked){
        this.elmSideBar = document.getElementById(sideBarId);
        
        this.callOnItemClicked = callOnItemClicked;
    }

    /**
     * data contains the following key
     * 
     * name,
     * host,
     * database,
     * orgQuery,
     * query,
     * tables:Array<str>
     * @param {JSON} data 
     */
    addSideBarItem(data){

        if(!this.isHostExist(data.host)){
            
            let divider = document.createElement("div");
            divider.className="section-divider";

            let section = document.createElement("div");
            section.id=data.host;
            section.className = "section-header";
            section.innerText = data.host;

            this.elmSideBar.appendChild(divider);
            this.elmSideBar.appendChild(section);
            this.elmSideBar.appendChild(divider);
            
        }

        let sideBarItem = document.createElement("a");
        sideBarItem.id=data.name;
        sideBarItem.className = "nav-link";
        sideBarItem.innerText = data.name;
        sideBarItem.setAttribute("data-name",data.name);
        sideBarItem.setAttribute("data-host",data.host);
        sideBarItem.setAttribute("data-database",data.database);
        sideBarItem.setAttribute("data-orgQuery",data.orgQuery);
        sideBarItem.setAttribute("data-query",data.query);
        sideBarItem.setAttribute("data-tables",data.tables);
        sideBarItem.addEventListener("click",(event)=>{

            this.callOnItemClicked(event.target.dataset);

            Array.from(this.elmSideBar.children).forEach(child=>{

                let className = "nav-link";

                if(child.id==event.target.id){
                    className = "nav-link active";
                }

                child.className = className;

            })

        });

        this.elmSideBar.appendChild(sideBarItem);

    }

    isHostExist(host){
        return document.getElementById(host);
    }


    resetSideBarState(){
        this.elmSideBar
    }
}
