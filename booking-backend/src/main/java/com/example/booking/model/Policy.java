package com.example.booking.model;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public enum Policy {
    NO_SMOKING,
    NO_PETS,
    NO_PARTIES,
    CHILD_FRIENDLY,
    LONG_TERM_ALLOWED,
    SELF_CHECKIN,
    QUIET_HOURS,
    ALCOHOL_ALLOWED,
    CANCELLATION_FLEXIBLE,
    CANCELLATION_MODERATE,
    CANCELLATION_STRICT;

    public static Set<String> names() {
        return Arrays.stream(values())
                .map(Enum::name)
                .collect(Collectors.toSet());
    }
}
