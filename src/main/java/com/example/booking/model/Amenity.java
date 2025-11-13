package com.example.booking.model;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum Amenity {
    WIFI,
    POOL,
    PARKING,
    AIR_CONDITIONING,
    HEATING,
    KITCHEN,
    WASHER,
    DRYER,
    TV,
    BREAKFAST,
    GYM,
    WORKSPACE,
    PET_FRIENDLY,
    SMOKE_DETECTOR,
    CARBON_MONOXIDE_DETECTOR;

    public static Set<String> names() {
        return Arrays.stream(values())
                .map(Enum::name)
                .collect(Collectors.toSet());
    }
}
