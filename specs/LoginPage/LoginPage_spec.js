var loginPageObj = require('./../../pageobjects/LoginPage/LoginPage.js');

var page = require('./../../pageobjects/BasePage/BasePage.js');

var OR = require('./../../json/objects.json');

var logger= require('./../../log');

var xl=require('./../../util/ReadExcel.js');
 
var dataReaderObj=require('./../../util/DataReader.js');

//describe("Login to Application", function() {
	
//	var testData=xl.readFromExcel('login','');

describe('Login Page - ', function () {
    var dataReadPromise = dataReaderObj.ReadDataFromFile('testdata', 'login');
    var username = [];
    var password = [];
    var url = [];

    beforeEach(function () {
        dataReadPromise.then(function (results) {
            for (var i = 0, len = results.length; i < len; i++) {
                url[i] = results[i].url;
                username[i] = results[i].username;
                password[i] = results[i].password;
                if (typeof url[i] == 'string') {
                    url[i] = url[i];
                }
                else {
                    url[i] = url[i].text;
                }
            }
        });
    });

    it('should login the user', function () {
        dataReadPromise.then(function () {
            //helperObj.IsNonAngularPage(true);
            
           

//           allure.createStep('START --> Login User specification........', function () {
//           })();
            page.OpenUrl(url[0]);
//            allure.createStep('Opened the Url.', function () {
//            }
//            )();
            
            browser.driver.manage().window().maximize();

            loginPageObj.EnterUsername(username[0]);
//            allure.createStep('Entered username.', function () {
//            })();

            loginPageObj.EnterPassword(password[0]);
//            allure.createStep('Entered password.', function () {
//            })();

            loginPageObj.ClickLoginButton();
//            allure.createStep('Clicked on login button.', function () {
//            })();
            
            
        });
    });
    
    it("verify the title of the Page", function() {
    	
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
    
    it("veriy all links present on page", function() {
    	
    	element.all(by.tagName("a")).getText().then(function(text){
    		
    		for(var i=0; i<text.length; i++){
    			
    			
    			console.log(text[i]);
    		}
    		
    		
    		
    	});
    	
    	
    	
    	
    });



	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	/*testData.forEach(function(data){
		
		
		it("login", function() {
			
			console.log(data.username+data.password+data.url);
			
			
		});
		
		
		
	});*/
	

	//var actualTitle="https://archway-premiernutrition-qa.azurewebsites.net/home";

	/*it("should login the user successfully", function() {

		page.OpenUrl(OR.testsiteurl);
		
		logger.log('info','navigating to the web site');
		
		
		browser.driver.manage().window().maximize();
		
		logger.log('info','Maximize the Window');
		

		loginPageObj.EnterUsername(OR.testdata.username);
		
		logger.log('info','Enter Username');
		

		loginPageObj.EnterPassword(OR.testdata.password);
		
		logger.log('info','Enter Password');
		

		loginPageObj.ClickLoginButton();
		
		logger.log('info','Click on Submit Button');
		

		browser.sleep(8000);
		
		logger.log('info','Application hold for some second');
		


	

	});*/

});