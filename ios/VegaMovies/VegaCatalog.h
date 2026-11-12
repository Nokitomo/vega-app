#import <Foundation/Foundation.h>
@interface VegaCatalogBackground : NSObject
+ (void)registerTasks;
+ (void)handleEvents:(NSString *)identifier completion:(void (^)(void))completion;
@end
