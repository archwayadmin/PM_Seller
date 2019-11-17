var XLSX=require('xlsx');

describe("tc1", function() {
	
	
	it("test1", function() {
		
		
		var workbook= XLSX.readFile('./testdata/testdata.xlsx');
		
		var worksheet=workbook.Sheets['login'];
		
		//var  cell='A2';
		
		var a=XLSX.utils.sheet_to_json(worksheet);
		
		a.forEach(function(data){
			
			console.log(data.username+data.password+data.url);
			
		});
		
		//console.log("the A2 value is:"+worksheet[cell].v);
		
		
		
		
	});
	
}); 