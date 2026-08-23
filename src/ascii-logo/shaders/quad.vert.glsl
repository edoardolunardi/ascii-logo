// Shared vertex stage for the two full-frame passes. The plane is already in clip space.

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
