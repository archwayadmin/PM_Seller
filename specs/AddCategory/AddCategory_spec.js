var loginPageObj = require('./../../pageobjects/LoginPage/LoginPage.js');

var addCategory= require('./../../pageobjects/AddCategory/AddCategory.js');

var page = require('./../../pageobjects/BasePage/BasePage.js');

var OR = require('./../../json/objects.json');

var logger= require('./../../log');

var selectwraper= require('./../../Select-Wrapper.js');

var myselect= new selectwraper(by.xpath("//select[@id='DefaultPriceScheduleID']"));

// will select value in selectwarpper later


describe("New category addition", function() {
	
	
	it("user should be able to add new category successfully", function() {
		
		addCategory.clickOnMasterMenu();
		
		logger.log('info','Click on MasterMenu');
		
		
		addCategory.clickOnCategoryLink();
		
		logger.log('info','Click on Category');
		
		
		addCategory.clickOnNewCategoryLink();
		
		logger.log('info','Click on new  Category icon');
		
		
		addCategory.enterValueInCategoryId("demo123");
		
		logger.log('info','Enter Category ID');
		
		
		addCategory.enterValueInCategoryName("test category");
		
		logger.log('info','Enter Category name');
		
		
		addCategory.enterValueInDescription("test description");
		
		logger.log('info','Click on Category description');
		
		
		addCategory.clickOnCreateButton();
		
		logger.log('info','Click on create Button');
		
		
		browser.sleep(4000);
		
	
		
		
	});
it("Verify Title of the CategoryPage", function() {
    	
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
    
    it("veriy links present on the CategoryPage", function() {
    	
    	element.all(by.tagName("a")).getText().then(function(text){
    		
    		for(var i=0; i<text.length; i++){
    			
    			
    			console.log(text[i]);
    		}
    		
    		
    		
    	});
    	
    	
    	
    	
    });


	
});