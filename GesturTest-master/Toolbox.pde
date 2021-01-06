
// Load and start "first" camera found
Capture loadCamera() {
  
  // Get camera list
  String[] cams = Capture.list();

  // Assert there to be at least one camera
  if (cams.length == 0) throw new Error("No cameras available");

  // Setup first camera
  Capture cam = new Capture(this, cams[0]);
  
  // Start up camera
  cam.start();
  
  return cam;
  
}

// Assert the screen size to be the same as that of the camera,
// and make sure the given resolution nicely divides
// the width and height of the cameras/screens resolution
void assertCameraSize(Capture cam, int res) {
  // Assert matching size
  if (cam.height != height || cam.width != width)
    throw new Error("Please use size("+cam.width+","+cam.height+");");
  if (width % res != 0 || height % res != 0)
    throw new Error("Choose different resolution proportional to "+gcd(width,height));
}

// Find greatest common divisor of p and q using Euclid's algorithm
int gcd(int p, int q) {
  while (q != 0) {
    int pt = q;
    q = p % q;
    p = pt;
  }
  return p;
}

// Calculate standard deviation by sqrt(1/n*sum((avg-x)^2))
float stdDev(ArrayList<Float> x) {
  float avg = 0;
  for (float v : x) avg += v;
  avg /= x.size();
  float dev = 0;
  for (float v : x) dev += Math.pow(v - avg,2);
  dev /= x.size();
  return (float) Math.sqrt(dev);
}
