#pragma once

#include <pebble.h>

#define SECTOR_STROKE 3
#define SECTOR_STEP_ANGLE (TRIG_MAX_ANGLE / 360) /* 1 degree */
#define HOUR_HAND_STROKE 6
#define MINUTE_HAND_STROKE 6

typedef enum FaceMode {
  FACE_MODE_HANDS = 0,
  FACE_MODE_DIGITAL,
  FACE_MODE_LARGE_DIGITAL
} FaceMode;

typedef struct SectorRay {
  int32_t angle;
  GColor colour;
} SectorRay;

typedef enum BoundaryEdge {
  EDGE_TOP = 0,
  EDGE_RIGHT,
  EDGE_BOTTOM,
  EDGE_LEFT
} BoundaryEdge;

typedef struct AppState {
  Window *window;
  Layer *canvas;
  FaceMode mode;
  bool show_date_tiles;
  GColor bg_colour;
  GColor hour_colour;
  GColor minute_colour;
  GColor hour_hand_colour;
  GColor minute_hand_colour;
  GColor complication_bg_colour;
  GColor complication_border_colour;
  GColor complication_text_colour;
  bool show_hands;
  bool show_date_complication;
  struct tm now;
  GRect cached_bounds;
  GPoint cached_centre;
  int16_t cached_min_dimension;
  int16_t cached_radius;
  bool cache_ready;
} AppState;

extern AppState s_state;
extern AppTimer *s_redraw_timer;
extern GFont s_date_font;
extern GFont s_day_font;
extern GFont s_large_digital_font;
extern int16_t s_date_font_height;
extern int16_t s_day_font_height;

void update_now(void);
void apply_debug_state(AppState *state);
bool should_ignore_config_messages(void);

bool parse_hex_colour(const char *text, GColor fallback, GColor *out);
FaceMode parse_mode(const char *text);

int32_t normalise_angle(int32_t angle);
int32_t hour_angle(const struct tm *now);
int32_t minute_angle(const struct tm *now);
int32_t opposite_split_angle(int32_t hour, int32_t minute);
GPoint point_on_ray(GPoint centre, int32_t radius, int32_t angle);
bool bounds_equal(GRect a, GRect b);
void rebuild_geometry_cache(GRect bounds);
void sort_rays(SectorRay *rays, size_t count);

void update_canvas(Layer *layer, GContext *ctx);
void release_render_resources(void);

void init_state(void);
