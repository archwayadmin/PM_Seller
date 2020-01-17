var path= require('path');

var page = require('./pageobjects/BasePage/BasePage.js');

describe("practise Test scenario", function() {
	
	
	it("test", function() { 
		
		
		
		browser.get("https://archway-premiernutrition-seller-qa.azurewebsites.net/login");
		
		browser.driver.manage().window().maximize();
		
		//browser.executeScript("history.go(0)")  refreshing the page
		
          element(by.xpath("//input[@id='username']")).sendKeys("sysadmin_seller");
		
		
		element(by.xpath("//input[@id='password']")).sendKeys("tmpadmin@123");
	
		
		
		
		element(by.xpath("//button[@id='submitBtn']")).click();
		
		element(by.xpath("//button[contains(text(),'Master Menu')]")).click();
		
		element(by.xpath("//a[contains(text(),'Users')]")).click();
		
		element(by.xpath("//button[@class='btn btn-primary float-right mt-3']")).click();
		
		
	 element(by.xpath("//div[@id='userFormNew']//form[@name='UserForm']//div[@class='col-sm-12']//div[@class='form-group row']//div[@class='col-sm-6']//ng-multiselect-dropdown[@id='UserGroups']//div[@class='multiselect-dropdown']//div//span[@class='dropdown-btn']")).click();
	 
	var ele= element(by.xpath("//div[@id='userFormNew']//input[@placeholder='Search']"));
	
	ele.clear();
	
	ele.sendKeys("Approver");
	
	 browser.sleep(8000);
	
	element(by.xpath("//div[2]/ul[2]/li[1]/div[1]")).click();
	
	 browser.navigate("http://www.yahoo.com");
	
	
	
	
	
      
	 
	 
	 
	

	
		
	
		
	
		
	

		
		//var ele=element(by.xpath("//div[@id='toast-container']"));
		
		//expect(ele.getText()).toEqual(" Error User not found.");
		
		/*var ele=element(by.xpath("//label[@class='btn btn-primary float-right']"));
		
        browser.executeScript("arguments[0].scrollIntoView();",ele);
		
		var fileToUpload = './images/demo.jpg',
		
	    absolutePath = path.resolve(__dirname, fileToUpload);

    element(by.css('input[type="file"]')).sendKeys(absolutePath);    
	  
	 element(by.xpath("//div[@id='toast-container']")).click();*/
		
		//page.uploadfile(fileToUpload,ele,absolutePath);
	 
	 
/*var ele=element(by.xpath("//div[@id='userFormNew']//input[@placeholder='Search']"));

ele.clear();

for(var i=1; i<=20; i++){
	
	element(by.xpath("//div[1]/div[2]/ul[2]/li["+i+"]/div[1]")).getText().then(function(text){
		
		if(text[i]=="APPROVER"){
			
			ele.click();	
		}
		else{
			
			
			console.log("element not found");
		}
		
		
	});
	
	
	
	
	
};*/


		
		
        
        
    
		
		
		
		
		
		
		
//	var ele=element(by.xpath("//label[@class='btn btn-primary float-right']"));
//	
//    browser.executeScript("arguments[0].scrollIntoView();",ele);
//    
//    absolutePath = path.resolve(__dirname, fileupload);
//    
//    element(by.css('input[type="file"]')).sendKeys(absolutePath);  
//    
//    //element(by.xpath('uploadButton')).click();
//    
//    element(by.xpath("//label[@class='btn btn-primary float-right']")).click();
//    
//    ele.click();
    
		
		//browser.executeScript("window.scrollBy(0, document.body.scrollHeight)");
		
		//browser.sleep(4000);
		
		
		
		//var ele=element(by.xpath("//div[@class='logoImg']"));
		
//		ele.getText().then(function(text){
//			
//			console.log(text);
//			
//		});
//		
		
		
		//var ele=element(by.xpath("//input[@id='username']"));
		
		//page.highlightElement(ele);// working fine
		
		//browser.driver.executeScript("arguments[0].setAttribute('style', arguments[1]);",ele.getWebElement(), "color: Red; border: 2px solid red;")
		
	//	browser.executeScript("document.getElementById('username').value='test01'");
		
		// upper written code working fine ..
		
		browser.sleep(5000);
		
	});
	
});