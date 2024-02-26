from sqlglot import parse_one,exp,Dialects
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/assets",StaticFiles(directory="web/assets"),name="static")

def get_cte_names(sql:str,dialect=Dialects.TSQL):

    sql_expression = parse_one(sql=sql,dialect=dialect)

    ctes = sql_expression.find_all(exp.CTE)
    
    return [cte.alias for cte in ctes]

def clean_table_name(table_name:str):
    """
    Sqlgloat return the [] as double quote 
    For example the table name [foo].[bar] will represented as "foo"."bar"
    so we have gto replace the double quote.

    Basically remove 

    1) double quote
    2) left bracket
    3) right bracket
    """
    return table_name.replace('"',"").replace("[","").replace("]","")

def get_full_table_name(table)->str:

    #if table does not have schema , just return the table name
    if table.db=="":
        return table.name
    
    return table.db+"."+table.name

def get_table_names(sql:str,dialect=Dialects.TSQL)->set[str]:

    sql_expression = parse_one(sql=sql,dialect=dialect)

    cte_names = get_cte_names(sql=sql,dialect=dialect)

    tables = sql_expression.find_all(exp.Table)

    return set([clean_table_name(get_full_table_name(table)) for table in tables if clean_table_name(get_full_table_name(table)) not in cte_names])

class SqlModel(BaseModel):
    sql:str
    dialect:Dialects=Dialects.TSQL

@app.get("/",response_class=FileResponse)
async def index():
   return "web/index.html"

@app.get("/ping")
async def ping():
   return "pong"

@app.post("/tables")
async def tables(model:SqlModel):
    try:
        return get_table_names(sql=model.sql,dialect=model.dialect)
    except Exception as e:
        pass





    

