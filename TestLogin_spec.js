var logger= require('./log');

var selectwraper= require('./Select-Wrapper.js');

var myselect= new selectwraper(by.xpath("//select[@id='Department']"));


describe("Login", function() {
	
	
	it("login  should be successfull", function() {
		
	
		browser.get("https://archway-premiernutrition-seller-qa.azurewebsites.net/login");
		
		logger.log('info','navigating to the web site');
		
		
		browser.driver.manage().window().maximize();
		
		logger.log('info','Maximize web site');
		
		element(by.xpath("//input[@id='username']")).sendKeys("sysadmin_seller");
		
		logger.log('info','Enter Username');
		
		
		
		element(by.xpath("//input[@id='password']")).sendKeys("tmpadmin@123");
		
		logger.log('info','Enter Passwor');
		
		element(by.xpath("//button[@id='submitBtn']")).click();
		
		logger.log('info','Enter Submit Button');
		
		element(by.xpath("//button[contains(text(),'Master Menu')]")).click();
		
		element(by.xpath("//a[contains(text(),'Users')]")).click();
		
		element(by.xpath("//button[@class='btn btn-primary float-right mt-3']")).click();
		
		 element(by.xpath("//div[@id='userFormNew']//input[@id='FirstName']")).sendKeys("demo")
		
		 element(by.xpath("//div[@id='userFormNew']//input[@id='LastName']")).sendKeys("demo123");
		 
		 element(by.xpath("//div[@id='userFormNew']//input[@id='Email']")).sendKeys("test@yahoo.com")
		 
		 element(by.xpath("//div[@id='userFormNew']//input[@id='Username']")).sendKeys("demouser")
		 
		 element(by.xpath("//div[@id='userFormNew']//form[@name='UserForm']//div[@class='col-sm-12']//div[@class='form-group row']//div[@class='col-sm-6']//ng-multiselect-dropdown[@id='UserGroups']//div[@class='multiselect-dropdown']//div//span[@class='dropdown-btn']")).click();
		 
		 browser.sleep(8000);
		 
		// var ele=element(by.xpath("//div[@id='userFormNew']//input[@placeholder='Search']"))
		 
		
		  element(by.xpath("//div[@id='userFormNew']//div[contains(text(),'Select All')]")).click();
		 

		 element(by.xpath("//div[@id='userFormNew']//input[@id='Phone']")).sendKeys("1234567891");
		
		 myselect.selectByText("Marketing");
		 
		 browser.sleep(8000);
		 
		var ele= element(by.xpath("//div[@id='userFormNew']//label[contains(text(),'Active')]"));
		
		 
	
		 browser.pause();


		
		/*logger.log('info','click on Master menu');
		
		element(by.xpath("//a[contains(text(),'Products')]")).click();
		
		logger.log('info','click on Products');
		
		//element(by.xpath("//input[@id='search-addon']")).sendKeys("Test");
		
		element(by.xpath("//button[@class='btn btn-primary float-right mt-3 ng-star-inserted']")).click();
		
		logger.log('info','click on new Products');
		
		element(by.xpath("//input[@id='ID']")).sendKeys("test123");
		
		logger.log('info','Enter product ID');
		
		element(by.xpath("//input[@id='name']")).sendKeys("Test_dummy");
		
		logger.log('info','Enter Product name');
		
		element(by.xpath("//textarea[@id='description']")).sendKeys("testing purpose");
		
		logger.log('info','Enter Prduct description');
		
		browser.sleep(4000);
		
		logger.log('info','Sleeping the browser for 4 second');
		
		myselect.selectByValue("15DollarSchedule");
		
		logger.log('info',' choosing the value from dropdown');
		
		
		
		element(by.xpath("//input[@placeholder='Effective date']")).sendKeys("11-22-2019");
		
		element(by.xpath("//input[@placeholder='Expiry date']")).sendKeys("11-29-2019");
		
		
		
		element(by.xpath("//input[@id='active']")).click();
		
		element(by.xpath("//button[@class='btn btn-primary mt-4 w-100']")).click();*/
		
		browser.sleep(4000);
		
			
		}); 
		
		
		
			
	
	
});