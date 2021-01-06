
class Pixelizer {
  
  private final int bluenessAlgorithm = 0;
  private final int threshhold = 61; // 61;
  private final int w;
  private final int h;
  protected final int res;
  protected final Capture cam;
  protected int[][] pixelized = {};
  
  boolean drawPixels = true;

  Pixelizer (int res, Capture cam) {
    this.res = res;
    this.cam = cam;
    this.w = cam.width / res;
    this.h = cam.height / res;
  }
  
  int[][] pixelize() {
    
    this.pixelized = new int[this.res][this.res];
    
    pushStyle();
    
    // Loop through all pixels
    for (int x = 0; x < this.res; x++)
    for (int y = 0; y < this.res; y++) {
      
      // Get color at middle of pixel
      int col = this.cam.pixels[(y*h+h/2)*this.cam.width+(x*w+w/2)];
      
      // Get blue value
      int b = this.blueness(col);
      
      // Compare to threshhold
      if (b < this.threshhold) b = 0;
      this.pixelized[x][y] = b;
      
      if (this.drawPixels) {
        // Draw pixel using alpha
        fill(0f,(float)b);
        rect(x*this.w, y*this.h, this.w, this.h);
      }
      
    }
    
    popStyle();
    
    return this.pixelized;
    
  }
  
  private int blueness(int col) {
    switch (this.bluenessAlgorithm) {
      case 0: return (int) max(0,(col & 255) - (col >> 16 & 255));
      case 1: return (int) max(0,2*(col & 255) - (col >> 8 & 255) - (col >> 16 & 255));
      case 2: return ((col & 255) + (col >> 8 & 255) + (col >> 16 & 255) > 2.5*255) ? 255 : (int) max(0,(col & 255) - (col >> 16 & 255));
      default: return 0;
    }
  }
  
}
