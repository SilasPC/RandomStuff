
interface FloatBuffer {
  void clearData();
  void addData(float val);
  boolean isFull();
  int available();
  float[] getData();
}

float[] concatFloatBuffers(FloatBuffer b1, FloatBuffer b2) {
  
  float[] res = new float[b1.available()+b2.available()];
  int i = 0;
  float[] data = b1.getData();
  for (int j = 0; j < b1.available(); j++) res[i++] = data[j];
  data = b2.getData();
  for (int j = 0; j < b2.available(); j++) res[i++] = data[j];
  return res;
  
}

// This is a buffer that calculates arbitrary orders of difference, aka. numerical derivatives
// This is just a substitute for Wekinator Input Helper
class DifferenceBuffer implements FloatBuffer {
  
  protected final int bufferLength;
  protected final int difOrder;
  private float[] outBuffer;
  private float[] inBuffer;
  private int inLength = 0;
  private int outLength = 0;
  
  DifferenceBuffer (int l, int d) {
    this.bufferLength = l;
    this.difOrder = d;
    this.outBuffer = new float[l];
    this.inBuffer = new float[d+1]; 
  }
  
  boolean isFull() {return this.outLength == this.bufferLength;}
  float[] getData() {return this.outBuffer;}
  int available() {return this.outLength;}
  
  void clearData() {
    // Empty in and out buffers
    this.outBuffer = new float[this.outBuffer.length];
    this.inBuffer = new float[this.inBuffer.length];
    this.inLength = 0;
    this.outLength = 0;
  }
  
  void addData(float val) {
    // Calculate difference value if needed
    if (this.difOrder > 0) {
      if (this.inLength < this.difOrder) {
        // Cannot calculate before inBuffer is full
        this.inBuffer[this.inLength++] = val;
        return;
      }
      // Shift inBuffer and push value
      for (int i = 1; i < this.inBuffer.length; i++) this.inBuffer[i-1] = this.inBuffer[i];
      this.inBuffer[this.inBuffer.length-1] = val;
      
      float[] oldArr = this.inBuffer;
      float[] newArr = new float[this.difOrder];
      // Calculate differences
      while (newArr.length > 0) {
        for (int i = 0; i < newArr.length; i++) newArr[i] = oldArr[i+1] - oldArr[i];
        oldArr = newArr;
        newArr = new float[newArr.length-1];
      }
      // New difference found
      val = oldArr[0];
    }
    
    // Simply append to outBuffer if not full
    if (this.outLength < this.outBuffer.length) {
      this.outBuffer[this.outLength++] = val;
      return;
    }
    
    // Shift outBuffer and push value
    for (int i = 1; i < this.outBuffer.length; i++) this.outBuffer[i-1] = this.outBuffer[i];
    this.outBuffer[this.outBuffer.length-1] = val;
  }
  
}
