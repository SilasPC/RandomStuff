
import processing.video.*;

final int res = 40;
final int trackingBufferLength = 10;
ObjectTracker tracker;
WekOSCWrapper wekinator;
Capture cam;
Graph g01, g02, g11, g12, g21, g22;
ObjectTracker.TrackedObj trackedObj;

void setup() {
  size(640,360);
  background(0);
  cam = loadCamera();
  wekinator = new WekOSCWrapper();
  g01 = new Graph(0,0,100,100,10,0);
  g11 = new Graph(0,100,100,100,10,1);
  g21 = new Graph(0,200,100,100,10,2);
  g02 = new Graph(100,0,100,100,10,0);
  g12 = new Graph(100,100,100,100,10,1);
  g22 = new Graph(100,200,100,100,10,2);
  noStroke();
}

boolean ready = false;
void draw() {
  
  if (cam.available()) {
    if (!ready) {
      cam.read();
      assertCameraSize(cam,res);
      tracker = new ObjectTracker(res, trackingBufferLength, cam);
      trackedObj = tracker.getNullTrackedObj();
      ready = true;
    } else processImage();
  }
  
}

long lastEstTime = System.currentTimeMillis();
int estFPS = 0;
int framesSinceEst = 0;

void processImage() {
  
  if (framesSinceEst >= 10) {
    estFPS = framesSinceEst * 1000 / (int) (System.currentTimeMillis()-lastEstTime);
    lastEstTime = System.currentTimeMillis();
    framesSinceEst = 0;
  } else framesSinceEst++;
  
  cam.read();
    
  // Draw camera image
  background(0);
  image(cam,0,0);
  
  // Run tracker
  cam.loadPixels();
  tracker.process();
  // cam.updatePixels();
  
  if (trackedObj.isAlive()) {
    Obj obj = trackedObj.getObj();
    float gdx = 2f*obj.getX()/res-1f;
    float gdy = 2f*obj.getY()/res-1f;
    g01.addData(gdx);
    g11.addData(gdx);
    g21.addData(gdx);
    g02.addData(gdy);
    g12.addData(gdy);
    g22.addData(gdy);
    wekinator.send(concatFloatBuffers(g11,g12));
    trackedObj.drawTrace();
    // println(testForCircle(trackedObj));
  } else {
    g01.clearData();
    g11.clearData();
    g21.clearData();
    g02.clearData();
    g12.clearData();
    g22.clearData();
  }
  
  g01.draw();
  g11.draw();
  g21.draw();
  g02.draw();
  g12.draw();
  g22.draw();
  
  fill(0);
  textSize(15);
  text("FPS: "+estFPS,width/2,height-5);
  
}

void keyReleased() {
  if (key == ' ') wekinator.stopRec();
}

void keyPressed() {
  if (key == 's') wekinator.recSingle();
  else if (key == ' ') wekinator.startRec();
  else if (key == 't') {
    Obj[] cast = {};
    Obj[] objs = tracker.lastHistories.keySet().toArray(cast);
    if (objs.length > 0) trackedObj = tracker.track(objs[0]);
    //testForCircle(trackedObj);
  }
}
