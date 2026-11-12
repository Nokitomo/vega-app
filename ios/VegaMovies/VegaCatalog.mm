#import "VegaCatalog.h"
#import <React/RCTBridgeModule.h>
#import <BackgroundTasks/BackgroundTasks.h>
#import <CommonCrypto/CommonDigest.h>
#import <zlib.h>

static NSString *const TaskID = @"com.vega.catalog.refresh";
static NSString *const SessionID = @"com.vega.catalog.transfer";
static NSString *const ManifestURL = @"https://raw.githubusercontent.com/Nokitomo/database/cinema-sqlite/manifest.json";
static NSUserDefaults *Prefs(void) { return [[NSUserDefaults alloc] initWithSuiteName:@"vega-catalog"]; }
static NSString *Root(void) {
  NSString *path = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject stringByAppendingPathComponent:@"VegaCatalog/cinema"];
  [[NSFileManager defaultManager] createDirectoryAtPath:path withIntermediateDirectories:YES attributes:nil error:nil];
  [[NSURL fileURLWithPath:path] setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
  return path;
}
static NSString *Path(NSString *name) { return [Root() stringByAppendingPathComponent:name]; }
static BOOL Matches(NSString *value, NSString *pattern) {
  return [value isKindOfClass:NSString.class] && [value rangeOfString:pattern options:NSRegularExpressionSearch].location != NSNotFound;
}
static BOOL SafeFile(NSString *path) { return [[[path stringByStandardizingPath] stringByDeletingLastPathComponent] isEqualToString:Root()]; }
static void State(NSString *status, NSNumber *bytes, NSNumber *total, NSString *error) {
  NSMutableDictionary *state = [@{@"status":status,@"bytes":bytes ?: @0,@"total":total ?: @0} mutableCopy];
  if (error) state[@"error"] = error;
  [Prefs() setObject:state forKey:@"state"];
}
static NSArray *Assets(NSDictionary *m, NSString *revision) {
  if (![m isKindOfClass:NSDictionary.class] || ![m[@"snapshot"] isKindOfClass:NSDictionary.class]) return nil;
  NSDictionary *snapshot = m[@"snapshot"];
  if (![m[@"catalogId"] isEqual:@"cinema"] || [m[@"schemaVersion"] intValue] != 1 ||
      [m[@"minimumReaderVersion"] intValue] != 1 || ![m[@"validationOnly"] isEqual:@NO] ||
      !Matches(m[@"revision"], @"^[a-f0-9]{64}$") || [snapshot[@"uncompressedBytes"] doubleValue] <= 0 ||
      [snapshot[@"uncompressedBytes"] doubleValue] > 34359738368.0 || !Matches(snapshot[@"uncompressedSha256"], @"^[a-f0-9]{64}$") ||
      ![m[@"deltas"] isKindOfClass:NSArray.class] || [m[@"deltas"] count] > 100) return nil;
  NSArray *deltas = m[@"deltas"];
  for (NSDictionary *a in [@[snapshot] arrayByAddingObjectsFromArray:deltas]) {
    if (![a isKindOfClass:NSDictionary.class] || ![a[@"name"] isKindOfClass:NSString.class]) return nil;
    if (!Matches(a[@"url"], @"^https://github\\.com/Nokitomo/database/releases/download/cinema-sqlite-v1-[a-f0-9]{64}/[a-zA-Z0-9._-]+\\.gz$") ||
        !Matches(a[@"sha256"], @"^[a-f0-9]{64}$") || [a[@"bytes"] doubleValue] <= 0 || [a[@"bytes"] doubleValue] > 17179869184.0 ||
        ![a[@"url"] hasSuffix:[@"/" stringByAppendingString:a[@"name"] ?: @""]]) return nil;
  }
  if ([revision isEqual:m[@"revision"]]) return @[];
  NSInteger start = -1;
  for (NSUInteger i=0; i<deltas.count; i++) if ([deltas[i][@"fromRevision"] isEqual:revision]) start = i;
  NSMutableArray *chain = [NSMutableArray new]; NSString *current = revision; double bytes = 0;
  for (NSInteger i=start; i>=0 && i<(NSInteger)deltas.count; i++) {
    NSDictionary *a = deltas[i]; if (![a[@"fromRevision"] isEqual:current]) break;
    [chain addObject:a]; current = a[@"toRevision"]; bytes += [a[@"bytes"] doubleValue];
    if ([current isEqual:m[@"revision"]]) { if (bytes < [snapshot[@"bytes"] doubleValue]) return chain; break; }
  }
  return @[snapshot];
}

@interface CatalogTransport : NSObject <NSURLSessionDownloadDelegate>
@property(nonatomic, strong) NSURLSession *session;
@property(copy) void (^completion)(void);
@property BOOL checking;
@property BOOL restartAfterPolicyChange;
+ (instancetype)shared;
- (void)check:(void (^)(BOOL))done;
- (void)next;
- (void)schedule;
@end
@implementation CatalogTransport
+ (instancetype)shared { static CatalogTransport *value; static dispatch_once_t once; dispatch_once(&once, ^{value=[CatalogTransport new];}); return value; }
- (instancetype)init {
  if ((self=[super init])) {
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration backgroundSessionConfigurationWithIdentifier:SessionID];
    // Each request carries the user policy. Keep the session capable of either
    // policy so a later opt-in is not blocked by its initial configuration.
    config.sessionSendsLaunchEvents = YES; config.allowsCellularAccess = YES;
    config.waitsForConnectivity = YES;
    self.session = [NSURLSession sessionWithConfiguration:config delegate:self delegateQueue:NSOperationQueue.mainQueue];
  } return self;
}
- (void)schedule {
  [[BGTaskScheduler sharedScheduler] cancelTaskRequestWithIdentifier:TaskID];
  if (![Prefs() boolForKey:@"automatic"]) return;
  BGAppRefreshTaskRequest *request = [[BGAppRefreshTaskRequest alloc] initWithIdentifier:TaskID];
  request.earliestBeginDate = [NSDate dateWithTimeIntervalSinceNow:7200];
  [[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:nil];
}
- (void)check:(void (^)(BOOL))done {
  if ([Prefs() boolForKey:@"paused"]) {done(YES); return;}
  if (self.checking || [[NSFileManager defaultManager] fileExistsAtPath:Path(@"pending.json")]) { done(YES); return; }
  self.checking = YES;
  [self.session getAllTasksWithCompletionHandler:^(NSArray<__kindof NSURLSessionTask *> *tasks) {
    dispatch_async(dispatch_get_main_queue(), ^{
      NSArray *active = [tasks filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSURLSessionTask *task, NSDictionary *bindings) {return task.state != NSURLSessionTaskStateCompleted;}]];
      if (active.count) {self.checking=NO; done(YES); return;}
      self.restartAfterPolicyChange=NO;
      NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:ManifestURL]];
      request.timeoutInterval = 30; request.allowsCellularAccess = [Prefs() boolForKey:@"cellular"];
      [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          self.checking = NO;
          NSDictionary *manifest = data.length <= 1024*1024 && !error && [(NSHTTPURLResponse *)response statusCode] == 200 ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
          if ([Prefs() boolForKey:@"forceSnapshot"] && [manifest isKindOfClass:NSDictionary.class]) {NSMutableDictionary *copy = [manifest mutableCopy]; copy[@"deltas"]=@[]; manifest=copy;}
          NSArray *assets = manifest ? Assets(manifest, [Prefs() stringForKey:@"revision"] ?: @"") : nil;
          if (!assets) {State(@"error",nil,nil,@"catalog.invalidManifest"); done(NO); return;}
          if (!assets.count) {State(@"ready",nil,nil,nil); done(YES); return;}
          NSDictionary *old = [NSDictionary dictionaryWithContentsOfFile:Path(@"resume-info.plist")];
          if (old && ![old[@"digest"] isEqual:assets.firstObject[@"sha256"]]) [[NSFileManager defaultManager] removeItemAtPath:Path(@"resume.data") error:nil];
          [[NSJSONSerialization dataWithJSONObject:manifest options:0 error:nil] writeToFile:Path(@"transfer.json") atomically:YES];
          [Prefs() setObject:assets forKey:@"assets"]; [Prefs() setInteger:0 forKey:@"assetIndex"];
          [Prefs() setBool:NO forKey:@"paused"];
          [self next]; done(YES);
        });
      }] resume];
    });
  }];
}
- (void)next {
  if ([Prefs() boolForKey:@"paused"]) return;
  NSArray *assets = [Prefs() arrayForKey:@"assets"] ?: @[];
  NSInteger index = [Prefs() integerForKey:@"assetIndex"];
  if (index >= (NSInteger)assets.count) {
    NSData *data = [NSData dataWithContentsOfFile:Path(@"transfer.json")];
    if (data && [data writeToFile:Path(@"pending.json") atomically:YES]) State(@"downloaded",nil,nil,nil);
    return;
  }
  NSDictionary *asset = assets[index]; NSString *file = Path([asset[@"sha256"] stringByAppendingString:@".gz"]);
  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:file error:nil];
  if ([attributes[NSFileSize] isEqual:asset[@"bytes"]]) { [Prefs() setInteger:index+1 forKey:@"assetIndex"]; [self next]; return; }
  NSDictionary *space = [[NSFileManager defaultManager] attributesOfFileSystemForPath:Root() error:nil];
  if ([space[NSFileSystemFreeSize] doubleValue] < [asset[@"bytes"] doubleValue]+268435456) {State(@"error",nil,nil,@"catalog.noSpace"); return;}
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:asset[@"url"]]];
  request.allowsCellularAccess = [Prefs() boolForKey:@"cellular"];
  NSData *resume = [NSData dataWithContentsOfFile:Path(@"resume.data")];
  NSURLSessionDownloadTask *task = resume ? [self.session downloadTaskWithResumeData:resume] : [self.session downloadTaskWithRequest:request];
  [[NSFileManager defaultManager] removeItemAtPath:Path(@"resume.data") error:nil];
  task.taskDescription = asset[@"sha256"]; [task resume]; State(@"downloading",@0,asset[@"bytes"],nil);
  [@{@"digest":asset[@"sha256"]} writeToFile:Path(@"resume-info.plist") atomically:YES];
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)task didWriteData:(int64_t)bytes totalBytesWritten:(int64_t)written totalBytesExpectedToWrite:(int64_t)expected {
  if (written > 17179869184LL) { [task cancel]; State(@"error",nil,nil,@"catalog.checksum"); return; }
  State(@"downloading",@(written),@(MAX(expected,0)),nil);
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)task didFinishDownloadingToURL:(NSURL *)location {
  NSArray *assets = [Prefs() arrayForKey:@"assets"];
  NSInteger index = [Prefs() integerForKey:@"assetIndex"];
  if (index >= (NSInteger)assets.count || ![task.taskDescription isEqual:assets[index][@"sha256"]]) return;
  NSDictionary *asset = assets[index];
  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:location.path error:nil];
  NSInteger status = [(NSHTTPURLResponse *)task.response statusCode];
  if ((status != 200 && status != 206) || ![attributes[NSFileSize] isEqual:asset[@"bytes"]]) {State(@"error",nil,nil,@"catalog.checksum"); return;}
  NSString *target = Path([asset[@"sha256"] stringByAppendingString:@".gz"]);
  [[NSFileManager defaultManager] removeItemAtPath:target error:nil];
  if (![[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:target] error:nil]) {State(@"error",nil,nil,@"catalog.io"); return;}
  [Prefs() setInteger:index+1 forKey:@"assetIndex"]; [self next];
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
  if (self.restartAfterPolicyChange) {[self check:^(BOOL success) {}]; return;}
  if (error && error.code != NSURLErrorCancelled) {
    NSData *resume = error.userInfo[NSURLSessionDownloadTaskResumeData];
    if (resume) [resume writeToFile:Path(@"resume.data") atomically:YES];
    State(@"error",nil,nil,@"catalog.transferFailed");
  }
}
- (void)URLSessionDidFinishEventsForBackgroundURLSession:(NSURLSession *)session {
  if (self.completion) {self.completion(); self.completion=nil;}
}
@end
@implementation VegaCatalogBackground
+ (void)registerTasks {
  [[BGTaskScheduler sharedScheduler] registerForTaskWithIdentifier:TaskID usingQueue:nil launchHandler:^(__kindof BGTask *task) {
    CatalogTransport *transport = CatalogTransport.shared;
    [transport schedule];
    task.expirationHandler = ^{[task setTaskCompletedWithSuccess:NO];};
    [transport check:^(BOOL success) {[task setTaskCompletedWithSuccess:success];}];
  }];
  (void)CatalogTransport.shared;
}
+ (void)handleEvents:(NSString *)identifier completion:(void (^)(void))completion {
  if ([identifier isEqual:SessionID]) CatalogTransport.shared.completion = completion; else completion();
}
@end

@interface VegaCatalog : NSObject <RCTBridgeModule> { FILE *_lines; CC_SHA256_CTX _hash; }
@end
@implementation VegaCatalog
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup {return NO;}
- (dispatch_queue_t)methodQueue {static dispatch_queue_t q; static dispatch_once_t once; dispatch_once(&once, ^{q=dispatch_queue_create("com.vega.catalog.io", DISPATCH_QUEUE_SERIAL);}); return q;}
RCT_REMAP_METHOD(root, rootResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {resolve(Root());}
RCT_REMAP_METHOD(configure, configureAutomatic:(BOOL)automatic cellular:(BOOL)cellular revision:(NSString *)revision title:(NSString *)title resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  BOOL changed = [Prefs() boolForKey:@"cellular"] != cellular;
  [Prefs() setBool:automatic forKey:@"automatic"]; [Prefs() setBool:cellular forKey:@"cellular"]; [Prefs() setObject:revision forKey:@"revision"];
  dispatch_async(dispatch_get_main_queue(), ^{
    CatalogTransport *transport=CatalogTransport.shared;
    [transport schedule];
    if(changed) {
      [[NSFileManager defaultManager] removeItemAtPath:Path(@"resume.data") error:nil];
      [transport.session getAllTasksWithCompletionHandler:^(NSArray<__kindof NSURLSessionTask *> *tasks) {
        dispatch_async(dispatch_get_main_queue(), ^{if(tasks.count) {transport.restartAfterPolicyChange=YES; for(NSURLSessionTask *task in tasks) [task cancel];}});
      }];
    }
    resolve(nil);
  });
}
RCT_REMAP_METHOD(start, startForceSnapshot:(BOOL)forceSnapshot resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [Prefs() setBool:NO forKey:@"paused"];
  [Prefs() setBool:forceSnapshot forKey:@"forceSnapshot"];
  dispatch_async(dispatch_get_main_queue(), ^{[CatalogTransport.shared check:^(BOOL success) {if(success) resolve(nil); else reject(@"catalog.network",@"catalog.transferFailed",nil);}];});
}
RCT_REMAP_METHOD(pause, pauseResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [Prefs() setBool:YES forKey:@"paused"];
  [CatalogTransport.shared.session getAllTasksWithCompletionHandler:^(NSArray<__kindof NSURLSessionTask *> *tasks) {
    for (NSURLSessionDownloadTask *task in tasks) [task cancelByProducingResumeData:^(NSData *data) {if (data) [data writeToFile:Path(@"resume.data") atomically:YES];}];
    State(@"paused",nil,nil,nil); resolve(nil);
  }];
}
RCT_REMAP_METHOD(cancel, cancelResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [Prefs() setBool:YES forKey:@"paused"]; [[BGTaskScheduler sharedScheduler] cancelTaskRequestWithIdentifier:TaskID];
  [CatalogTransport.shared.session getAllTasksWithCompletionHandler:^(NSArray<__kindof NSURLSessionTask *> *tasks) {
    for (NSURLSessionTask *task in tasks) [task cancel];
    for (NSString *name in [[NSFileManager defaultManager] contentsOfDirectoryAtPath:Root() error:nil])
      if ([name hasSuffix:@".gz"] || [@[@"pending.json",@"transfer.json",@"resume.data"] containsObject:name]) [[NSFileManager defaultManager] removeItemAtPath:Path(name) error:nil];
    State(@"idle",nil,nil,nil); resolve(nil);
  }];
}
RCT_REMAP_METHOD(status, statusResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {resolve([Prefs() dictionaryForKey:@"state"] ?: @{@"status":@"idle",@"bytes":@0,@"total":@0});}
RCT_REMAP_METHOD(pending, pendingResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {resolve([NSString stringWithContentsOfFile:Path(@"pending.json") encoding:NSUTF8StringEncoding error:nil]);}
RCT_REMAP_METHOD(acknowledge, acknowledgeResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [Prefs() setBool:NO forKey:@"forceSnapshot"];
  for (NSString *name in [[NSFileManager defaultManager] contentsOfDirectoryAtPath:Root() error:nil])
    if ([name hasSuffix:@".gz"] || [@[@"pending.json",@"transfer.json",@"resume.data"] containsObject:name]) [[NSFileManager defaultManager] removeItemAtPath:Path(name) error:nil];
  State(@"ready",nil,nil,nil); resolve(nil);
}
RCT_REMAP_METHOD(gunzip, gunzipSource:(NSString *)source target:(NSString *)target limit:(double)limit resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  if (!SafeFile(source) || !SafeFile(target) || limit<=0 || limit>68719476736.0) {reject(@"catalog.io",@"catalog.io",nil); return;}
  gzFile input = gzopen(source.fileSystemRepresentation,"rb"); FILE *output = fopen(target.fileSystemRepresentation,"wb");
  BOOL ok = input && output; unsigned char buffer[262144]; double count = 0;
  if (ok) {int n; while ((n=gzread(input,buffer,sizeof(buffer)))>0) {count+=n; if(count>limit || fwrite(buffer,1,n,output)!=(size_t)n) {ok=NO; break;}} if(n<0) ok=NO;}
  if(input && gzclose(input)!=Z_OK) ok=NO; if(output && fclose(output)!=0) ok=NO;
  if(ok) resolve(nil); else reject(@"catalog.io",@"catalog.io",nil);
}
RCT_REMAP_METHOD(openLines, openLinesFile:(NSString *)file resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  if (_lines) fclose(_lines); _lines=NULL;
  if (SafeFile(file)) _lines=fopen(file.fileSystemRepresentation,"rb");
  if(_lines) resolve(nil); else reject(@"catalog.io",@"catalog.io",nil);
}
RCT_REMAP_METHOD(readLines, readLinesResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  if(!_lines) {reject(@"catalog.io",@"catalog.io",nil); return;}
  NSMutableArray *rows=[NSMutableArray new]; NSUInteger total=0;
  while(rows.count<128 && total<1048576) {
    NSMutableData *line=[NSMutableData new]; int c;
    while((c=fgetc(_lines))!=EOF && c!='\n') {unsigned char b=c; [line appendBytes:&b length:1]; if(line.length>8388608) {reject(@"catalog.io",@"catalog.io",nil); return;}}
    if(!line.length) break;
    NSString *value=[[NSString alloc] initWithData:line encoding:NSUTF8StringEncoding]; if(!value) {reject(@"catalog.io",@"catalog.io",nil); return;}
    [rows addObject:value]; total+=line.length;
  } resolve(rows);
}
RCT_REMAP_METHOD(closeLines, closeLinesResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {if(_lines) fclose(_lines); _lines=NULL; resolve(nil);}
RCT_REMAP_METHOD(beginHash, beginHashPrefix:(NSString *)prefix resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {CC_SHA256_Init(&_hash); NSData *data=[prefix dataUsingEncoding:NSUTF8StringEncoding]; CC_SHA256_Update(&_hash,data.bytes,(CC_LONG)data.length); resolve(nil);}
RCT_REMAP_METHOD(appendHash, appendHashValues:(NSArray<NSString *> *)values resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {for(NSString *value in values) {NSData *data=[value dataUsingEncoding:NSUTF8StringEncoding]; CC_SHA256_Update(&_hash,data.bytes,(CC_LONG)data.length);} resolve(nil);}
RCT_REMAP_METHOD(finishHash, finishHashResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {unsigned char digest[CC_SHA256_DIGEST_LENGTH]; CC_SHA256_Final(digest,&_hash); NSMutableString *value=[NSMutableString new]; for(int i=0;i<CC_SHA256_DIGEST_LENGTH;i++) [value appendFormat:@"%02x",digest[i]]; resolve(value);}
@end
