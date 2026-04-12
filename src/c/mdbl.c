#include <pebble.h>
#include <string.h>

#include "mdbl.h"
#include "message_keys.auto.h"

AppState s_state;
AppTimer *s_redraw_timer;
GFont s_date_font;
GFont s_day_font;
GFont s_large_digital_font;
int16_t s_date_font_height;
int16_t s_day_font_height;

void update_now(void) {
  time_t now_secs = time(NULL);
  struct tm *local = localtime(&now_secs);
  if (local) {
    s_state.now = *local;
  } else {
    memset(&s_state.now, 0, sizeof(s_state.now));
  }
}

void init_state(void) {
  update_now();

  s_state.mode = FACE_MODE_HANDS;
  s_state.show_date_tiles = false;
  s_state.bg_colour = GColorFromRGB(255, 255, 170);
  s_state.hour_colour = GColorFromRGB(85, 85, 170);
  s_state.minute_colour = GColorFromRGB(255, 85, 0);
  s_state.hour_hand_colour = GColorBlack;
  s_state.minute_hand_colour = GColorBlack;
  s_state.complication_bg_colour = s_state.bg_colour;
  s_state.complication_border_colour = s_state.minute_colour;
  s_state.complication_text_colour = s_state.hour_colour;
  s_state.show_hands = true;
  s_state.show_date_complication = false;
  s_state.cache_ready = false;

  apply_debug_state(&s_state);
}

static void redraw_timer_callback(void *context) {
  (void)context;
  update_now();
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }

  const uint32_t millis_to_next_minute = (uint32_t)((60 - s_state.now.tm_sec) * 1000) + 50;
  s_redraw_timer = app_timer_register(millis_to_next_minute, redraw_timer_callback, NULL);
}

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  (void)context;
  if (should_ignore_config_messages()) {
    return;
  }

  Tuple *bg = dict_find(iter, MESSAGE_KEY_BG_COLOUR);
  Tuple *hour = dict_find(iter, MESSAGE_KEY_HOUR_COLOUR);
  Tuple *minute = dict_find(iter, MESSAGE_KEY_MINUTE_COLOUR);
  Tuple *mode = dict_find(iter, MESSAGE_KEY_FACE_MODE);
  Tuple *date = dict_find(iter, MESSAGE_KEY_SHOW_DATE_TILES);
  Tuple *date_complication = dict_find(iter, MESSAGE_KEY_SHOW_DATE_COMPLICATION);
  Tuple *comp_bg_colour = dict_find(iter, MESSAGE_KEY_C_BG_COLOUR);
  Tuple *comp_border_colour = dict_find(iter, MESSAGE_KEY_C_BORDER_COLOUR);
  Tuple *comp_text_colour = dict_find(iter, MESSAGE_KEY_C_TEXT_COLOUR);
  Tuple *hour_hand_colour = dict_find(iter, MESSAGE_KEY_H_HAND_COLOUR);
  Tuple *minute_hand_colour = dict_find(iter, MESSAGE_KEY_M_HAND_COLOUR);
  Tuple *show_hands = dict_find(iter, MESSAGE_KEY_SHOW_HANDS);
  Tuple *hand_colour = dict_find(iter, MESSAGE_KEY_HAND_COLOUR);

  if (bg && bg->type == TUPLE_CSTRING) {
    parse_hex_colour(bg->value->cstring, s_state.bg_colour, &s_state.bg_colour);
  }

  if (hour && hour->type == TUPLE_CSTRING) {
    parse_hex_colour(hour->value->cstring, s_state.hour_colour, &s_state.hour_colour);
  }

  if (minute && minute->type == TUPLE_CSTRING) {
    parse_hex_colour(minute->value->cstring, s_state.minute_colour, &s_state.minute_colour);
  }

  if (hour_hand_colour && hour_hand_colour->type == TUPLE_CSTRING) {
    parse_hex_colour(hour_hand_colour->value->cstring, s_state.hour_hand_colour, &s_state.hour_hand_colour);
  }

  if (minute_hand_colour && minute_hand_colour->type == TUPLE_CSTRING) {
    parse_hex_colour(minute_hand_colour->value->cstring, s_state.minute_hand_colour, &s_state.minute_hand_colour);
  }

  if (comp_bg_colour && comp_bg_colour->type == TUPLE_CSTRING) {
    parse_hex_colour(comp_bg_colour->value->cstring, s_state.complication_bg_colour, &s_state.complication_bg_colour);
  }

  if (comp_border_colour && comp_border_colour->type == TUPLE_CSTRING) {
    parse_hex_colour(comp_border_colour->value->cstring, s_state.complication_border_colour, &s_state.complication_border_colour);
  }

  if (comp_text_colour && comp_text_colour->type == TUPLE_CSTRING) {
    parse_hex_colour(comp_text_colour->value->cstring, s_state.complication_text_colour, &s_state.complication_text_colour);
  }

  if (mode && mode->type == TUPLE_CSTRING) {
    s_state.mode = parse_mode(mode->value->cstring);
    if (s_state.mode == FACE_MODE_LARGE_DIGITAL) {
      s_state.show_date_tiles = false;
    }
  }

  if (date && s_state.mode != FACE_MODE_LARGE_DIGITAL) {
    s_state.show_date_tiles = date->value->int32 == 1;
  }

  if (date_complication && (date_complication->type == TUPLE_INT || date_complication->type == TUPLE_UINT)) {
    s_state.show_date_complication = date_complication->value->int32 == 1;
  }

  if (show_hands && (show_hands->type == TUPLE_INT || show_hands->type == TUPLE_UINT)) {
    s_state.show_hands = show_hands->value->int32 == 1;
  }

  if (hand_colour && (hand_colour->type == TUPLE_INT || hand_colour->type == TUPLE_UINT)) {
    const GColor legacy_colour = hand_colour->value->int32 == 1 ? GColorWhite : GColorBlack;

    if (!hour_hand_colour || hour_hand_colour->type != TUPLE_CSTRING) {
      s_state.hour_hand_colour = legacy_colour;
    }
    if (!minute_hand_colour || minute_hand_colour->type != TUPLE_CSTRING) {
      s_state.minute_hand_colour = legacy_colour;
    }
  }

  if (s_state.mode == FACE_MODE_LARGE_DIGITAL) {
    s_state.show_date_tiles = false;
  }

  update_now();
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }
}

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);

  s_state.canvas = layer_create(bounds);
  layer_set_update_proc(s_state.canvas, update_canvas);
  layer_add_child(root, s_state.canvas);
}

static void window_unload(Window *window) {
  (void)window;
  layer_destroy(s_state.canvas);
  s_state.canvas = NULL;
}

static void init(void) {
  init_state();
  s_date_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
  s_day_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
  s_large_digital_font = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DIGITAL_LARGE_72));
  s_date_font_height = (int16_t)graphics_text_layout_get_content_size("8", s_date_font, GRect(0, 0, 40, 40), GTextOverflowModeWordWrap, GTextAlignmentCenter).h;
  s_day_font_height = (int16_t)graphics_text_layout_get_content_size("W", s_day_font, GRect(0, 0, 40, 40), GTextOverflowModeWordWrap, GTextAlignmentCenter).h;

  s_state.window = window_create();
  window_set_background_color(s_state.window, GColorBlack);
  window_set_window_handlers(s_state.window, (WindowHandlers){
    .load = window_load,
    .unload = window_unload
  });
  window_stack_push(s_state.window, true);

  app_message_register_inbox_received(inbox_received_handler);
  app_message_open(512, 64);
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }
  const uint32_t millis_to_next_minute = (uint32_t)((60 - s_state.now.tm_sec) * 1000) + 50;
  s_redraw_timer = app_timer_register(millis_to_next_minute, redraw_timer_callback, NULL);
}

static void deinit(void) {
  if (s_redraw_timer) {
    app_timer_cancel(s_redraw_timer);
    s_redraw_timer = NULL;
  }
  if (s_large_digital_font) {
    fonts_unload_custom_font(s_large_digital_font);
    s_large_digital_font = NULL;
  }
  release_render_resources();
  window_destroy(s_state.window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
