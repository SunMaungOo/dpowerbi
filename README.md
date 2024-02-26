data-model-structure.json


{
"tables":
[

/*
table object
*/
{
"name":"",
"columns":
[
],
"partitions":
[
  {
     "name":""
     "mode":"import",
     "source":{
        "type":"m",
        "expression": 
        [
           //those line represent the partition line
           //the new line are represented by #(lf)
           "
           Source = Sql.Database("host name","database name",[Query=""])
           ",
           "",
           "",
        ]
     }
  }
]


}

]

}
