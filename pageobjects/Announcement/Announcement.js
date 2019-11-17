var announcement;


announcement= function(){
	
	var announcementIcon= element(by.xpath("//button[@class='btn btn-primary float-right mt-3 mb-2']"));
	
	var announcementValue=element(by.xpath("//div[@class='ngx-editor-textarea']"));
	
	var userGroup;
	
	var startdate= element(by.xpath("//input[@id='startDate']"));
	
	var endDate=element(by.xpath("//input[@id='endDate']"));
	
	var createIcon= element(by.xpath("//button[@class='btn btn-primary btn-block']"));
	
	
	this.clickOnNewIcon= function(){
		
		announcementIcon.click();
		
	};
	
	
	this.enterAnnouncementValue= function(value){
		
		
		announcementValue.sendKeys(value)
		
		
	};
	
	this.enterStartdate= function(value){
		
		endDate.sendKeys(value);
		
	};
	
   this.enterEnddate= function(value){
		
	endDate.sendKeys(value);
		
	};
	
	
	this.clickOnCreateIcon= function(){
		
		createIcon.click();
		
	};
	 
	 
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
};

module.exports= new announcement();