var BasePage;

BasePage= function(){
	
	
	
	this.OpenUrl = function (value) {
        browser.get(value);
    };
    
    this.getPageTitle=function(){
    	
    	
    	
    	return browser.getTitle();
    		
    	
    };
    
    
    
   this.high= function(ele){
	   
	   console.log("locator---:"+el.locator());
	   
	   browser.driver.executeScript("arguments[0].setAttribute('style','background: yellow ; border:2px solid red;')",ele);
	   
	   
	   
	   
   };
    	
    
    this.logOut= function(){
    	
    element(by.xpath("//span[@class='d-md-inline']")).click();
    
    element(by.xpath("//a[contains(text(),'Logout')]")).click();
    	
    	
    	
    	
    	
    };
    
    this.searchValueAndClick= function(text, value ){
    
    	var ele=element(by.xpath("aasda"));
    	
    	ele.sendKeys(text);
    	
    	element(by.xpath("//div[@id='userFormNew']//div[contains(text(),'APPROVER')]")).getText().then(function(val){
    		
    		if(val==""){
    			
    			ele.click();
    		}
    		
    	});
    	
    	
    };
    
    
    this.CheckElementIsPresent = function (ele, callback) {
        if (ele == undefined) {
            callback(false);
        } else {
            ele.isPresent().then(function (isPresent) {
                callback(isPresent);
            });
        }
    }
	
	

	
	
	
};

module.exports= new BasePage();