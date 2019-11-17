
var OR= require('./../../json/objects.json');
var LoginPage;
LoginPage = function () {

    var usernameTxtBx = element(by.xpath(OR.locators.Loginpage.username));
    
    var passwordTxtBx = element(by.xpath(OR.locators.Loginpage.password));
   
    var loginBtn = element(by.xpath(OR.locators.Loginpage.submitBtn));
    
    
    this.login= function(){
    	
    	
    	
  
    	
    	
    }

    
    this.EnterUsername = function (value) {
    	
        usernameTxtBx.sendKeys(value);
    };

    this.EnterPassword = function (value) {
        passwordTxtBx.sendKeys(value);
    };

   

    this.ClickLoginButton = function () {
        loginBtn.click();
    };
    
    this.getAllLinks= function(){
    	
      element.all(by.tagName("a")).getText().then(function(text){
			
			for(var i=0; i<text.length; i++){
				
				
				console.log(text[i]);
			}
			
			
			
		});
    	
    	
    	
    	
    };

};

module.exports = new LoginPage();


