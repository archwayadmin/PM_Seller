var usergroup;

usergroup= function(){
	
	var userGroupIcon= element(by.xpath("//a[contains(text(),'User Groups')]"));
	
	var newUserGroupIcon= element(by.xpath("//button[@class='btn btn-primary float-right mt-3']"));
	
	var userGroupId= element(by.xpath("//input[@id='ID']"));
	
	var userGroupName= element(by.xpath("//input[@id='name']"));
	
	var userGroupDescription= element(by.xpath("//textarea[@id='description']"));
	
	var userGroupType;
	
	var createIcon= element(by.xpath("//button[@class='btn btn-primary mt-4 w-100']"));
	
	
	this.clickOnUserGroupIcon= function(){
		
		userGroupIcon.click();
		
	} ;
	
	
	this.clickOnNewUserGroupIcon= function(){
		
		newUserGroupIcon.click();
		
	};
	
	
	this.enterId= function(value){
		
		userGroupId.click();
		
	};
	
	this.enterUserGroupName= function(value){
		
		userGroupName.sendKeys(value);
		
	};
	
	this.enterUserGroupDescription= function(value){
		
		userGroupDescription.sendKeys(value);
		
	};
	
	
	this.clickOnCreate= function(){
		
		createIcon.clear();
		
	};
	
	
	
	
};

module.exports= new usergroup();
