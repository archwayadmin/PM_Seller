var loginPageObj = require('./../../pageobjects/LoginPage/LoginPage.js');

var addProduct = require('./../../pageobjects/AddProduct/AddProduct.js');

var page = require('./../../pageobjects/BasePage/BasePage.js');

var OR = require('./../../json/objects.json');

var logger = require('./../../log');

var selectwraper = require('./../../Select-Wrapper.js');

var myselect = new selectwraper(by
		.xpath("//select[@id='DefaultPriceScheduleID']"));

describe("Add product", function() {

	it("product should be added successfully", function() {

		addProduct.clickOnMastermenu();

		logger.log('info', 'Click on MasterMenu');

		addProduct.clickOnProduct();

		logger.log('info', 'Click on Product Icon');

		addProduct.clickOnNewProductIcon();

		logger.log('info', 'Click on New ProductIcon');

		addProduct.enterProductId("test123456");

		logger.log('info', 'Enter Product ID');

		addProduct.enterProductName("testdemo123");

		logger.log('info', 'Enter Product Name');

		addProduct.enterProductDescription("demo1234");

		logger.log('info', 'Enter Product Description');

		browser.sleep(4000);

		myselect.selectByValue("15DollarSchedule");

		logger.log('info', 'Select value from dropdown');

		addProduct.enterEffectiveDate("11-22-2019");

		logger.log('info', 'Enter effctive Date');

		addProduct.enterExpirDate("11-29-2019");

		logger.log('info', 'Enter Expiray Date');

		element(by.xpath("//input[@id='active']")).click();

		logger.log('info', 'Click on checkBox');

		addProduct.clickOnSaveButton();

		logger.log('info', 'Click on Save Button');

	});
	
it("Verify Title of the ProductPage", function() {
    	
    	browser.getTitle().then(function(expTitle){
    		
    		var actualTtile="Premier Nutrition Seller";
    		
    		if(expTitle==actualTtile){
    			
    			console.log("Title is correct");
    			
    		}
    		
    		else{
    			
    			console.log("Title is not correct");
    		}
    		
    	});
    	
    	
    });
    
    it("Veriy  links present on ProductPage", function() {
    	
    	element.all(by.tagName("a")).getText().then(function(text){
    		
    		for(var i=0; i<text.length; i++){
    			
    			
    			console.log(text[i]);
    		}
    		
    		
    		
    	});
    	
    	
    	
    	
    });


	
	

});