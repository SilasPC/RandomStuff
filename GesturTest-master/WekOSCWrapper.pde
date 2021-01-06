
import netP5.*;
import oscP5.*;

class WekOSCWrapper {
  
  private final OscP5 oscP5 = new OscP5(Main.this,12000);
  private final NetAddress dest = new NetAddress("localhost", 6448);
  private final String inputNameSpace = "/wek/inputs";
  
  private boolean sendNextOnly = false;
  
  void tmp(float d1, float d2) {
  
    OscMessage msg = new OscMessage(this.inputNameSpace);
    msg.add(d1);
    msg.add(d2);
    this.oscP5.send(msg,dest);
    
  }
  
  void send(float[] floats) {
    OscMessage msg = new OscMessage(this.inputNameSpace);
    for (float f : floats) msg.add(f);
    this.oscP5.send(msg,this.dest);
    if (this.sendNextOnly) this.stopRec();
    this.sendNextOnly = false;
  }
  
  void send(FloatBuffer buffer) {
    OscMessage msg = new OscMessage(this.inputNameSpace);
    float[] data = buffer.getData();
    for (int i = 0; i < buffer.available(); i++) msg.add(data[i]);
    this.oscP5.send(msg,this.dest);
    if (this.sendNextOnly) this.stopRec();
    this.sendNextOnly = false;
  }
  
  void recSingle() {
    this.sendNextOnly = true;
    this.startRec();
  }
  
  void startDtwRec(int gesture) {this.oscP5.send(new OscMessage("/wekinator/control/startDtwRecording").add(gesture),this.dest);}
  void stopDtwRec() {this.oscP5.send(new OscMessage("/wekinator/control/stopDtwRecording"),this.dest);}
  void startRec() {this.oscP5.send(new OscMessage("/wekinator/control/startRecording"),this.dest);}
  void stopRec() {this.oscP5.send(new OscMessage("/wekinator/control/stopRecording"),this.dest);}
  
}

void oscEvent(OscMessage msg) {
  if (msg.checkAddrPattern("/outputs-1")&&msg.checkTypetag("ffff")) {
    for (int i = 0; i < 4; i++) print(msg.get(i).floatValue()," ");
    println();
  }
}
