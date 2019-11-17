var loginPageObj = require('./../../pageobjects/LoginPage/LoginPage.js');

var addProduct = require('./../../pageobjects/AddProduct/AddProduct.js');

var userObj = require('./../../pageobjects/Users/User.js');

//import {userIcon} from "./../../pageobjects/Users/User.js"



var page = require('./../../pageobjects/BasePage/BasePage.js');

//var helperobj=require('./../../pageobjects/util/Helper.js');


var OR = require('./../../json/objects.json');

var logger = require('./../../log');

var selectwraper = require('./../../Select-Wrapper.js');

var myselect = new selectwraper(by
		.xpath("//select[@id='Department']"));

describe("user creation", function() {

	it("user should be added successfully", function() {
		
		
		addProduct.clickOnMastermenu();
		
		logger.log('info','click on User Icon');

		userObj.clickOnUserIcon();
		
		logger.log('info','click on User Icon');

		userObj.clickOnNewUserIcon();
		
		logger.log('info','click on New User Icon');
		
		userObj.enterFirstName("test123");
		
		logger.log('info','Enter FirstName');
		
		userObj.enterSecondName("test11");
		
		logger.log('info','Enter Second Name');
		
		userObj.enterEmail("test@yyahoo.com");
		
		logger.log('info','Enter Email');
		
		userObj.enterUsername("demosuer");
		
		logger.log('info','Enter email-id');
		
		userObj.clickOnUserGroup();
		
		logger.log('info','click on User Group Icon');
		
		userObj.clickOnSelectAll();
		
		logger.log('info','click on select all option');
		
		userObj.enterphonenumber("1234567899");
		
		logger.log('info','Enter Phone Number');
		
		 myselect.selectByText("Marketing");
		 
		 logger.log('info','selects the department');
		
		userObj.clickonCheckbox();
		
		logger.log('info','click on checkbox');
		
		browser.sleep(10000);
		
		userObj.clickOnCreateButton();
		
		logger.log('info','click create Button');

	});
	
it("verify the title of the User Page", function() {
    	
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
    
    it("veriy links present on User Page", function() {
    	
    
    	
    	element.all(by.tagName("a")).getText().then(function(text){
    		
    		for(var i=0; i<text.length; i++){
    			
    			
    			console.log(text[i]);
    		}
    		
    		
    		
    	});
    	
    	
    	
    	
    });
    
   
    
    


	
	

});